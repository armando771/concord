package call

import (
	"context"
	"testing"
	"time"
)

func soundboardCall(t *testing.T, participants ...*participantState) (*Service, *[]string) {
	t.Helper()
	svc := CallService(nil, newCapPublisher(), nil, nil, nil, nil, nil)
	svc.lookupUser = func(_ context.Context, uid string) (UserInfo, error) { return UserInfo{ID: uid}, nil }
	svc.SetSoundLookup(fakeSoundLookup{sounds: map[string]SoundInfo{"snd": {ID: "snd", ServerID: "srv"}}})
	srv, ch := "srv", "ch"
	ac := &activeCall{
		info:         &Call{ID: "c1", Type: TypeChannel, ServerID: &srv, ChannelID: &ch, Status: StatusActive},
		participants: map[string]*participantState{},
	}
	for _, p := range participants {
		p.joinedAt = time.Now()
		ac.participants[p.userID] = p
	}
	svc.calls["c1"] = ac
	var played []string
	svc.OnSoundPlayed(func(callID, userID string) { played = append(played, callID+"/"+userID) })
	return svc, &played
}

// Badge Barulhento: o som tocado conta para quem tocou, se alguém ouviu.
func TestSoundPlayedIsReportedWithAudience(t *testing.T) {
	svc, played := soundboardCall(t, &participantState{userID: "ana"}, &participantState{userID: "bia"})
	if err := svc.TriggerSoundboard(context.Background(), "c1", "ana", "snd"); err != nil {
		t.Fatal(err)
	}
	if len(*played) != 1 || (*played)[0] != "c1/ana" {
		t.Fatalf("played = %v", *played)
	}
}

func TestSoundPlayedAloneOrToTheDeafIsNotReported(t *testing.T) {
	svc, played := soundboardCall(t, &participantState{userID: "ana"}, &participantState{userID: "bia", deafened: true})
	if err := svc.TriggerSoundboard(context.Background(), "c1", "ana", "snd"); err != nil {
		t.Fatal(err)
	}
	if len(*played) != 0 {
		t.Fatalf("played = %v, want nothing (ninguém ouvindo)", *played)
	}
}

func TestRejectedSoundIsNotReported(t *testing.T) {
	svc, played := soundboardCall(t, &participantState{userID: "ana", muted: true}, &participantState{userID: "bia"})
	if err := svc.TriggerSoundboard(context.Background(), "c1", "ana", "snd"); err == nil {
		t.Fatal("muted played a sound")
	}
	if len(*played) != 0 {
		t.Fatalf("played = %v", *played)
	}
}
