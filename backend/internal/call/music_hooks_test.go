package call

import (
	"testing"
	"time"
)

type nopPublisher struct{}

func (nopPublisher) SendToUser(string, []byte)      {}
func (nopPublisher) BroadcastToCall(string, []byte) {}
func (nopPublisher) BroadcastToRoom(string, []byte) {}

func newHookService() *Service {
	return &Service{
		publisher:     nopPublisher{},
		calls:         make(map[string]*activeCall),
		busy:          make(map[string]string),
		screenSharers: make(map[string]map[string]struct{}),
	}
}

func TestVoiceLocationAndParticipants(t *testing.T) {
	s := newHookService()
	ch, srv := "ch1", "srv1"
	s.calls["c1"] = &activeCall{
		info: &Call{ID: "c1", Type: TypeChannel, ChannelID: &ch, ServerID: &srv, Status: StatusActive},
		participants: map[string]*participantState{
			"ana": {userID: "ana", joinedAt: time.Unix(1, 0)},
			"bia": {userID: "bia", joinedAt: time.Unix(2, 0)},
		},
	}
	s.busy["ana"], s.busy["bia"] = "c1", "c1"

	loc, ok := s.VoiceLocationOf("ana")
	if !ok || loc.CallID != "c1" || loc.ChannelID != "ch1" || loc.ServerID != "srv1" {
		t.Fatalf("loc = %+v ok=%v", loc, ok)
	}
	if _, ok := s.VoiceLocationOf("caio"); ok {
		t.Fatal("caio não está em call")
	}
	ids := s.ParticipantIDs("c1")
	if len(ids) != 2 || ids[0] != "ana" || ids[1] != "bia" {
		t.Fatalf("ids = %v", ids)
	}
}

func TestHooksFireOnLeaveAndClose(t *testing.T) {
	s := newHookService()
	ch, srv := "ch1", "srv1"
	s.calls["c1"] = &activeCall{
		info:         &Call{ID: "c1", Type: TypeChannel, ChannelID: &ch, ServerID: &srv, Status: StatusActive},
		participants: map[string]*participantState{"ana": {userID: "ana"}, "bia": {userID: "bia"}},
	}
	var left, ended []string
	s.OnParticipantLeft(func(callID, userID string) { left = append(left, callID+"/"+userID) })
	s.OnCallEnded(func(callID string) { ended = append(ended, callID) })

	if _, _, err := s.detachParticipant("c1", "ana"); err != nil {
		t.Fatal(err)
	}
	if err := s.closeCall("c1"); err != nil {
		t.Fatal(err)
	}
	if len(left) != 1 || left[0] != "c1/ana" {
		t.Fatalf("left = %v", left)
	}
	if len(ended) != 1 || ended[0] != "c1" {
		t.Fatalf("ended = %v", ended)
	}
}
