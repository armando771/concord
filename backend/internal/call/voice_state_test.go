package call

import (
	"encoding/json"
	"sync"
	"testing"
)

type sentEvent struct {
	target string
	event  map[string]json.RawMessage
}

// fakePublisher registra para onde cada evento foi enviado.
type fakePublisher struct {
	mu   sync.Mutex
	sent []sentEvent
}

func (f *fakePublisher) record(target string, raw []byte) {
	var event map[string]json.RawMessage
	_ = json.Unmarshal(raw, &event)
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sent = append(f.sent, sentEvent{target: target, event: event})
}

func (f *fakePublisher) SendToUser(userID string, event []byte)      { f.record("user:"+userID, event) }
func (f *fakePublisher) BroadcastToCall(callID string, event []byte) { f.record("call:"+callID, event) }
func (f *fakePublisher) BroadcastToRoom(room string, event []byte)   { f.record(room, event) }

func channelCallWith(publisher EventPublisher, participantIDs ...string) *Service {
	s := serviceWithCall("call-1", participantIDs...)
	s.publisher = publisher
	serverID := "server-1"
	s.calls["call-1"].info.ServerID = &serverID
	return s
}

func TestSetVoiceStateBroadcastsToCallAndServer(t *testing.T) {
	pub := &fakePublisher{}
	s := channelCallWith(pub, "user-1")

	if err := s.SetVoiceState("call-1", "user-1", true, false); err != nil {
		t.Fatalf("SetVoiceState: %v", err)
	}

	targets := map[string]bool{}
	for _, e := range pub.sent {
		targets[e.target] = true
		var typ string
		_ = json.Unmarshal(e.event["type"], &typ)
		if typ != "call:voice" {
			t.Fatalf("event type = %q, want call:voice", typ)
		}
		var payload struct {
			CallID   string `json:"call_id"`
			UserID   string `json:"user_id"`
			Muted    bool   `json:"muted"`
			Deafened bool   `json:"deafened"`
		}
		_ = json.Unmarshal(e.event["payload"], &payload)
		if payload.CallID != "call-1" || payload.UserID != "user-1" || !payload.Muted || payload.Deafened {
			t.Fatalf("payload = %+v", payload)
		}
	}
	// Quem está na chamada e quem só vê o servidor (lista do canal de voz).
	if !targets["call:call-1"] || !targets["server:server-1"] {
		t.Fatalf("targets = %v, want call:call-1 and server:server-1", targets)
	}
}

func TestSetVoiceStateIsKeptInParticipantList(t *testing.T) {
	s := channelCallWith(&fakePublisher{}, "user-1", "user-2")

	_ = s.SetVoiceState("call-1", "user-1", true, true)

	infos := s.participantInfos("call-1")
	got := map[string][2]bool{}
	for _, p := range infos {
		got[p.UserID] = [2]bool{p.Muted, p.Deafened}
	}
	if got["user-1"] != [2]bool{true, true} || got["user-2"] != [2]bool{false, false} {
		t.Fatalf("voice states = %v", got)
	}
}

func TestSetVoiceStateRejectsNonParticipant(t *testing.T) {
	pub := &fakePublisher{}
	s := channelCallWith(pub, "user-1")

	if err := s.SetVoiceState("call-1", "intruso", true, false); err == nil {
		t.Fatal("expected error for non-participant")
	}
	if len(pub.sent) != 0 {
		t.Fatalf("sent %d events for non-participant", len(pub.sent))
	}
}
