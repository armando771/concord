package call

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"
)

type fakeSoundLookup struct {
	sounds map[string]SoundInfo
}

func (f fakeSoundLookup) FindSound(_ context.Context, soundID string) (SoundInfo, error) {
	s, ok := f.sounds[soundID]
	if !ok {
		return SoundInfo{}, errors.New("not found")
	}
	return s, nil
}

type capPublisher struct {
	callEvents   map[string][][]byte
	userEvents   map[string][][]byte
	serverEvents map[string][][]byte
}

func newCapPublisher() *capPublisher {
	return &capPublisher{
		callEvents:   make(map[string][][]byte),
		userEvents:   make(map[string][][]byte),
		serverEvents: make(map[string][][]byte),
	}
}

func (p *capPublisher) SendToUser(userID string, event []byte) {
	p.userEvents[userID] = append(p.userEvents[userID], event)
}

func (p *capPublisher) BroadcastToCall(callID string, event []byte) {
	p.callEvents[callID] = append(p.callEvents[callID], event)
}

func (p *capPublisher) BroadcastToRoom(room string, event []byte) {
	p.serverEvents[room] = append(p.serverEvents[room], event)
}

func TestTriggerSoundboard(t *testing.T) {
	pub := newCapPublisher()
	svc := CallService(nil, pub, nil, nil, nil, nil, nil)
	svc.lookupUser = func(_ context.Context, uid string) (UserInfo, error) {
		return UserInfo{ID: uid, Username: uid, DisplayName: "User " + uid}, nil
	}
	emoji := "🎺"
	svc.SetSoundLookup(fakeSoundLookup{
		sounds: map[string]SoundInfo{
			"snd-1": {ID: "snd-1", ServerID: "srv-1", Name: "Corneta", Emoji: &emoji, DurationMs: 1800},
			"snd-2": {ID: "snd-2", ServerID: "srv-other", Name: "Outro", DurationMs: 1200},
		},
	})

	srvID := "srv-1"
	chID := "ch-1"
	svc.calls["call-1"] = &activeCall{
		info: &Call{
			ID:        "call-1",
			Type:      TypeChannel,
			ServerID:  &srvID,
			ChannelID: &chID,
			Status:    StatusActive,
		},
		participants: map[string]*participantState{
			"u1": {userID: "u1", role: RoleMember, joinedAt: time.Now()},
		},
	}

	raw, _ := json.Marshal(SoundboardPayload{CallID: "call-1", SoundID: "snd-1"})
	svc.HandleCallMessage("u1", "call:soundboard", raw)

	if len(pub.callEvents["call-1"]) != 1 {
		t.Fatalf("expected 1 broadcast event on call-1, got %d", len(pub.callEvents["call-1"]))
	}

	// Cooldown blocks immediate second trigger
	svc.HandleCallMessage("u1", "call:soundboard", raw)
	if len(pub.callEvents["call-1"]) != 1 {
		t.Fatalf("expected cooldown to block second trigger")
	}

	// Reset cooldown and test muted user
	svc.calls["call-1"].participants["u1"].lastSoundAt = time.Time{}
	svc.calls["call-1"].participants["u1"].muted = true
	if err := svc.TriggerSoundboard(context.Background(), "call-1", "u1", "snd-1"); !errors.Is(err, ErrSoundboardMuted) {
		t.Fatalf("expected ErrSoundboardMuted, got %v", err)
	}

	// Sound from another server is rejected
	svc.calls["call-1"].participants["u1"].muted = false
	svc.calls["call-1"].participants["u1"].lastSoundAt = time.Time{}
	if err := svc.TriggerSoundboard(context.Background(), "call-1", "u1", "snd-2"); !errors.Is(err, ErrSoundNotFound) {
		t.Fatalf("expected ErrSoundNotFound for foreign server sound, got %v", err)
	}
}
