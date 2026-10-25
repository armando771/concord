package call

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"
)

func lockedCallWith(pub *fakePublisher, participantIDs ...string) *Service {
	s := channelCallWith(pub, participantIDs...)
	channelID := "geral"
	s.calls["call-1"].info.ChannelID = &channelID
	s.lookupUser = func(_ context.Context, id string) (UserInfo, error) {
		return UserInfo{ID: id, Username: id, DisplayName: id}, nil
	}
	return s
}

func (f *fakePublisher) eventsOf(typ string) []sentEvent {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := []sentEvent{}
	for _, e := range f.sent {
		var t string
		_ = json.Unmarshal(e.event["type"], &t)
		if t == typ {
			out = append(out, e)
		}
	}
	return out
}

func TestOnlyParticipantsLock(t *testing.T) {
	pub := &fakePublisher{}
	s := lockedCallWith(pub, "ana")
	ctx := context.Background()

	if err := s.SetLocked(ctx, "call-1", "intruso", true); !errors.Is(err, ErrNotAllowed) {
		t.Fatalf("intruso locking = %v, want ErrNotAllowed", err)
	}
	if err := s.SetLocked(ctx, "call-1", "ana", true); err != nil {
		t.Fatalf("ana locking: %v", err)
	}
	if !s.calls["call-1"].info.Locked {
		t.Fatal("call should be locked")
	}
	targets := map[string]bool{}
	for _, e := range pub.eventsOf("call:lock") {
		targets[e.target] = true
	}
	if !targets["call:call-1"] || !targets["server:server-1"] {
		t.Fatalf("call:lock targets = %v", targets)
	}
}

func TestDMCannotBeLocked(t *testing.T) {
	s := lockedCallWith(&fakePublisher{}, "ana")
	s.calls["call-1"].info.Type = TypeDM
	if err := s.SetLocked(context.Background(), "call-1", "ana", true); !errors.Is(err, ErrNotLockable) {
		t.Fatalf("locking DM = %v, want ErrNotLockable", err)
	}
}

func TestLockedGate(t *testing.T) {
	s := lockedCallWith(&fakePublisher{}, "ana")
	ac := s.calls["call-1"]
	now := time.Now()

	if !canEnterLockedLocked(ac, "bia", now) {
		t.Fatal("unlocked room must let anyone in")
	}
	ac.info.Locked = true
	if canEnterLockedLocked(ac, "bia", now) {
		t.Fatal("locked room let bia in without approval")
	}
	if !canEnterLockedLocked(ac, "ana", now) {
		t.Fatal("participant must stay allowed")
	}
	admitLocked(ac, "bia", now.Add(time.Minute))
	if !canEnterLockedLocked(ac, "bia", now) {
		t.Fatal("admitted user must enter")
	}
	if canEnterLockedLocked(ac, "bia", now) {
		t.Fatal("admission pass must be single use")
	}
	admitLocked(ac, "caio", now.Add(-time.Second))
	if canEnterLockedLocked(ac, "caio", now) {
		t.Fatal("expired pass must not work")
	}
}

func TestKnockAcceptFlow(t *testing.T) {
	pub := &fakePublisher{}
	s := lockedCallWith(pub, "ana", "bia")
	ctx := context.Background()
	_ = s.SetLocked(ctx, "call-1", "ana", true)

	if err := s.RequestJoin(ctx, "call-1", "caio"); err != nil {
		t.Fatalf("RequestJoin: %v", err)
	}
	knocks := pub.eventsOf("call:knock")
	if len(knocks) != 1 || knocks[0].target != "call:call-1" {
		t.Fatalf("call:knock = %+v", knocks)
	}
	if reqs := s.joinRequestsOf("call-1"); len(reqs) != 1 || reqs[0].ID != "caio" {
		t.Fatalf("join requests = %+v", reqs)
	}

	// Bia aceita primeiro; a resposta atrasada da Ana não faz nada.
	if err := s.RespondJoinRequest(ctx, "call-1", "bia", "caio", true); err != nil {
		t.Fatalf("respond: %v", err)
	}
	if err := s.RespondJoinRequest(ctx, "call-1", "ana", "caio", false); err != nil {
		t.Fatalf("late respond: %v", err)
	}
	if n := len(pub.eventsOf("call:knock_resolved")); n != 1 {
		t.Fatalf("knock_resolved sent %d times, want 1", n)
	}
	accepted := pub.eventsOf("call:knock_accepted")
	if len(accepted) != 1 || accepted[0].target != "user:caio" {
		t.Fatalf("knock_accepted = %+v", accepted)
	}
	if len(pub.eventsOf("call:knock_declined")) != 0 {
		t.Fatal("late decline must be ignored")
	}
	if !canEnterLockedLocked(s.calls["call-1"], "caio", time.Now()) {
		t.Fatal("accepted user must be able to enter")
	}
}

func TestKnockDeclineAndCooldown(t *testing.T) {
	pub := &fakePublisher{}
	s := lockedCallWith(pub, "ana")
	ctx := context.Background()
	_ = s.SetLocked(ctx, "call-1", "ana", true)

	_ = s.RequestJoin(ctx, "call-1", "caio")
	_ = s.RespondJoinRequest(ctx, "call-1", "ana", "caio", false)
	declined := pub.eventsOf("call:knock_declined")
	if len(declined) != 1 || declined[0].target != "user:caio" {
		t.Fatalf("knock_declined = %+v", declined)
	}
	if err := s.RequestJoin(ctx, "call-1", "caio"); !errors.Is(err, ErrKnockCooldown) {
		t.Fatalf("knock right after decline = %v, want ErrKnockCooldown", err)
	}
}

func TestOnlyParticipantsRespond(t *testing.T) {
	s := lockedCallWith(&fakePublisher{}, "ana")
	ctx := context.Background()
	_ = s.SetLocked(ctx, "call-1", "ana", true)
	_ = s.RequestJoin(ctx, "call-1", "caio")
	if err := s.RespondJoinRequest(ctx, "call-1", "caio", "caio", true); !errors.Is(err, ErrNotAllowed) {
		t.Fatalf("self-approve = %v, want ErrNotAllowed", err)
	}
}

func TestUnlockAcceptsPending(t *testing.T) {
	pub := &fakePublisher{}
	s := lockedCallWith(pub, "ana")
	ctx := context.Background()
	_ = s.SetLocked(ctx, "call-1", "ana", true)
	_ = s.RequestJoin(ctx, "call-1", "caio")
	_ = s.RequestJoin(ctx, "call-1", "duda")

	_ = s.SetLocked(ctx, "call-1", "ana", false)
	if n := len(pub.eventsOf("call:knock_accepted")); n != 2 {
		t.Fatalf("knock_accepted = %d, want 2", n)
	}
	if reqs := s.joinRequestsOf("call-1"); len(reqs) != 0 {
		t.Fatalf("pending after unlock = %+v", reqs)
	}
}

func TestKnockOnUnlockedRoomIsAcceptedRightAway(t *testing.T) {
	pub := &fakePublisher{}
	s := lockedCallWith(pub, "ana")
	_ = s.RequestJoin(context.Background(), "call-1", "caio")
	if n := len(pub.eventsOf("call:knock_accepted")); n != 1 {
		t.Fatalf("knock_accepted = %d, want 1", n)
	}
	if n := len(pub.eventsOf("call:knock")); n != 0 {
		t.Fatalf("no one should be asked, got %d knocks", n)
	}
}

func TestCancelKnock(t *testing.T) {
	pub := &fakePublisher{}
	s := lockedCallWith(pub, "ana")
	ctx := context.Background()
	_ = s.SetLocked(ctx, "call-1", "ana", true)
	_ = s.RequestJoin(ctx, "call-1", "caio")

	_ = s.CancelJoinRequest("call-1", "caio")
	if reqs := s.joinRequestsOf("call-1"); len(reqs) != 0 {
		t.Fatalf("pending after cancel = %+v", reqs)
	}
	if n := len(pub.eventsOf("call:knock_resolved")); n != 1 {
		t.Fatalf("knock_resolved = %d, want 1", n)
	}
}

func TestClosingCallReleasesKnockers(t *testing.T) {
	pub := &fakePublisher{}
	s := lockedCallWith(pub, "ana")
	ctx := context.Background()
	_ = s.SetLocked(ctx, "call-1", "ana", true)
	_ = s.RequestJoin(ctx, "call-1", "caio")

	if err := s.closeCall("call-1"); err != nil {
		t.Fatalf("closeCall: %v", err)
	}
	declined := pub.eventsOf("call:knock_declined")
	if len(declined) != 1 || declined[0].target != "user:caio" {
		t.Fatalf("knock_declined = %+v", declined)
	}
	var payload KnockAnswerEvent
	_ = json.Unmarshal(declined[0].event["payload"], &payload)
	if payload.Reason != KnockEnded {
		t.Fatalf("reason = %q, want %q", payload.Reason, KnockEnded)
	}
}

func TestDisconnectGivesRejoinPass(t *testing.T) {
	s := lockedCallWith(&fakePublisher{}, "ana", "bia")
	s.calls["call-1"].info.Locked = true
	recordLeaves(s)

	s.leaveAllCalls("bia")
	// O leave real (trocado no teste) tiraria bia da lista.
	delete(s.calls["call-1"].participants, "bia")

	if !canEnterLockedLocked(s.calls["call-1"], "bia", time.Now()) {
		t.Fatal("user dropped by disconnect must rejoin a locked room")
	}
}
