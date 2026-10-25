package call

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

type livePayload struct {
	CallID string `json:"call_id"`
	UserID string `json:"user_id"`
	Active bool   `json:"active"`
}

func stubLookupUser(s *Service) {
	s.lookupUser = func(_ context.Context, id string) (UserInfo, error) { return UserInfo{ID: id}, nil }
}

// liveEvents devolve os call:live enviados para `target`.
func liveEvents(pub *fakePublisher, target string) []livePayload {
	var out []livePayload
	for _, e := range pub.sent {
		var typ string
		_ = json.Unmarshal(e.event["type"], &typ)
		if e.target != target || typ != "call:live" {
			continue
		}
		var p livePayload
		_ = json.Unmarshal(e.event["payload"], &p)
		out = append(out, p)
	}
	return out
}

func TestSetScreenShareAnnouncesLiveToServer(t *testing.T) {
	pub := &fakePublisher{}
	s := channelCallWith(pub, "user-1", "user-2")
	stubLookupUser(s)

	if err := s.SetScreenShare(context.Background(), "call-1", "user-1", true); err != nil {
		t.Fatalf("SetScreenShare: %v", err)
	}

	live := liveEvents(pub, "server:server-1")
	want := livePayload{CallID: "call-1", UserID: "user-1", Active: true}
	if len(live) != 1 || live[0] != want {
		t.Fatalf("call:live = %+v, want [%+v]", live, want)
	}
	var screenToPeer bool
	for _, e := range pub.sent {
		var typ string
		_ = json.Unmarshal(e.event["type"], &typ)
		if e.target == "user:user-2" && typ == "call:screen" {
			screenToPeer = true
		}
	}
	if !screenToPeer {
		t.Fatalf("call:screen não foi para user-2: %+v", pub.sent)
	}
}

func TestSetScreenShareStopAnnouncesLiveOff(t *testing.T) {
	pub := &fakePublisher{}
	s := channelCallWith(pub, "user-1", "user-2")
	stubLookupUser(s)
	s.screenSharers["call-1"] = map[string]struct{}{"user-1": {}}

	if err := s.SetScreenShare(context.Background(), "call-1", "user-1", false); err != nil {
		t.Fatalf("SetScreenShare: %v", err)
	}

	live := liveEvents(pub, "server:server-1")
	if len(live) != 1 || live[0].Active || live[0].UserID != "user-1" {
		t.Fatalf("call:live = %+v, want active=false de user-1", live)
	}
}

func TestDMScreenShareDoesNotAnnounceLive(t *testing.T) {
	pub := &fakePublisher{}
	s := serviceWithCall("call-1", "user-1", "user-2")
	s.publisher = pub
	stubLookupUser(s)

	if err := s.SetScreenShare(context.Background(), "call-1", "user-1", true); err != nil {
		t.Fatalf("SetScreenShare: %v", err)
	}

	for _, e := range pub.sent {
		if strings.HasPrefix(e.target, "server:") {
			t.Fatalf("evento para %s numa chamada sem servidor", e.target)
		}
	}
}

func TestDetachSharerAnnouncesLiveOff(t *testing.T) {
	pub := &fakePublisher{}
	s := channelCallWith(pub, "user-1", "user-2")
	s.screenSharers["call-1"] = map[string]struct{}{"user-1": {}}

	remaining, removed, err := s.detachParticipant("call-1", "user-1")
	if err != nil {
		t.Fatalf("detachParticipant: %v", err)
	}
	if remaining != 1 || !removed {
		t.Fatalf("remaining=%d removed=%v, want 1 true", remaining, removed)
	}
	live := liveEvents(pub, "server:server-1")
	if len(live) != 1 || live[0].Active || live[0].UserID != "user-1" {
		t.Fatalf("call:live = %+v, want active=false de user-1", live)
	}
	if _, still := s.screenSharers["call-1"]["user-1"]; still {
		t.Fatal("user-1 continua em screenSharers")
	}
}

func TestDetachNonSharerSendsNothing(t *testing.T) {
	pub := &fakePublisher{}
	s := channelCallWith(pub, "user-1", "user-2")

	if _, removed, err := s.detachParticipant("call-1", "user-1"); err != nil || !removed {
		t.Fatalf("detachParticipant: removed=%v err=%v", removed, err)
	}
	if len(pub.sent) != 0 {
		t.Fatalf("sent %d events, want 0", len(pub.sent))
	}
}

func TestCloseCallAnnouncesLiveOffForRemainingSharers(t *testing.T) {
	pub := &fakePublisher{}
	s := channelCallWith(pub, "user-1", "user-2")
	s.screenSharers["call-1"] = map[string]struct{}{"user-2": {}}

	if err := s.closeCall("call-1"); err != nil {
		t.Fatalf("closeCall: %v", err)
	}

	live := liveEvents(pub, "server:server-1")
	if len(live) != 1 || live[0].Active || live[0].UserID != "user-2" {
		t.Fatalf("call:live = %+v, want active=false de user-2", live)
	}
	if _, ok := s.calls["call-1"]; ok {
		t.Fatal("chamada continua em memória")
	}
	if s.IsBusy("user-1") {
		t.Fatal("user-1 continua ocupado")
	}
}
