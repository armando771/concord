package call

import (
	"reflect"
	"testing"
)

func TestEligibleVoiceUsersNeedsSomeoneListening(t *testing.T) {
	s := serviceWithCall("call-1", "ana")
	if got := eligibleVoiceUsers(s.calls["call-1"]); len(got) != 0 {
		t.Fatalf("alone in call = %v, want nobody", got)
	}

	s = serviceWithCall("call-1", "ana", "bia")
	if got := eligibleVoiceUsers(s.calls["call-1"]); !reflect.DeepEqual(got, []string{"ana", "bia"}) {
		t.Fatalf("two people talking = %v, want both", got)
	}
}

func TestEligibleVoiceUsersSkipsMutedAndDeafened(t *testing.T) {
	s := serviceWithCall("call-1", "ana", "bia", "caio")
	s.calls["call-1"].participants["bia"].muted = true
	s.calls["call-1"].participants["caio"].deafened = true

	if got := eligibleVoiceUsers(s.calls["call-1"]); !reflect.DeepEqual(got, []string{"ana"}) {
		t.Fatalf("eligible = %v, want only ana (bia muted, caio deafened)", got)
	}
}

func TestEligibleVoiceUsersOtherDeafenedDoesNotCount(t *testing.T) {
	// Falar para alguém que está surdo é o mesmo que falar sozinho.
	s := serviceWithCall("call-1", "ana", "bia")
	s.calls["call-1"].participants["bia"].deafened = true

	if got := eligibleVoiceUsers(s.calls["call-1"]); len(got) != 0 {
		t.Fatalf("eligible = %v, want nobody", got)
	}
}

func TestEligibleVoiceUsersIgnoresRingingCalls(t *testing.T) {
	s := serviceWithCall("call-1", "ana", "bia")
	s.calls["call-1"].info.Status = StatusRinging

	if got := eligibleVoiceUsers(s.calls["call-1"]); len(got) != 0 {
		t.Fatalf("ringing call = %v, want nobody", got)
	}
}

func TestActiveVoiceUsersCarriesCallAndServer(t *testing.T) {
	s := serviceWithCall("call-1", "ana", "bia")
	serverID := "server-1"
	s.calls["call-1"].info.ServerID = &serverID

	got := s.ActiveVoiceUsers()
	if len(got) != 2 || got[0].CallID != "call-1" || got[0].ServerID == nil || *got[0].ServerID != "server-1" {
		t.Fatalf("ActiveVoiceUsers = %+v", got)
	}
}
