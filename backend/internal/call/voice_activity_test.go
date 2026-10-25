package call

import (
	"reflect"
	"testing"
	"time"
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

func TestSpeakingIsReportedPerParticipant(t *testing.T) {
	s := serviceWithCall("call-1", "ana", "bia")
	t0 := time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)

	speaking := func(now time.Time) map[string]bool {
		got := map[string]bool{}
		for _, a := range s.activeVoiceUsersAt(now) {
			got[a.UserID] = a.Speaking
		}
		return got
	}

	if got := speaking(t0); got["ana"] || got["bia"] {
		t.Fatalf("nobody spoke yet, got %v", got)
	}

	if err := s.SetSpeaking("call-1", "ana", true, t0); err != nil {
		t.Fatalf("SetSpeaking: %v", err)
	}
	if got := speaking(t0.Add(time.Minute)); !got["ana"] || got["bia"] {
		t.Fatalf("ana speaking (still), got %v", got)
	}

	_ = s.SetSpeaking("call-1", "ana", false, t0.Add(time.Minute))
	if got := speaking(t0.Add(time.Minute + 5*time.Second)); !got["ana"] {
		t.Fatal("ana stopped 5s ago: still counts (pause)")
	}
	if got := speaking(t0.Add(time.Minute + 11*time.Second)); got["ana"] {
		t.Fatal("ana stopped 11s ago: silent")
	}
}

func TestSpeakingWhileMutedIsIgnored(t *testing.T) {
	s := serviceWithCall("call-1", "ana", "bia")
	s.calls["call-1"].participants["ana"].muted = true
	_ = s.SetSpeaking("call-1", "ana", true, time.Now())
	if s.calls["call-1"].participants["ana"].speaking {
		t.Fatal("a muted mic cannot be speaking")
	}
	if err := s.SetSpeaking("call-1", "caio", true, time.Now()); err == nil {
		t.Fatal("non-participant must be rejected")
	}
}

// O evento do WS ("call:speaking") é o que marca a voz captada que o XP de
// voz (level.Service, via ActiveVoiceUsers) exige.
func TestSpeakingMessageMarksParticipantAsSpeaking(t *testing.T) {
	s := serviceWithCall("call-1", "ana", "bia")

	s.HandleCallMessage("ana", "call:speaking", []byte(`{"call_id":"call-1","speaking":true}`))

	for _, a := range s.ActiveVoiceUsers() {
		if a.UserID == "ana" && !a.Speaking {
			t.Fatal("ana mandou call:speaking e não conta como falando")
		}
		if a.UserID == "bia" && a.Speaking {
			t.Fatal("bia não falou")
		}
	}
}

// "Parei de falar" repetido não pode esticar a janela de fala: só a
// transição falando → calado marca a última fala.
func TestSilentStopMessagesDoNotExtendSpeaking(t *testing.T) {
	s := serviceWithCall("call-1", "ana", "bia")
	t0 := time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)
	speaking := func(now time.Time) bool {
		for _, a := range s.activeVoiceUsersAt(now) {
			if a.UserID == "ana" {
				return a.Speaking
			}
		}
		return false
	}

	for i := 0; i < 5; i++ {
		_ = s.SetSpeaking("call-1", "ana", false, t0.Add(time.Duration(i)*9*time.Second))
	}
	if speaking(t0.Add(40 * time.Second)) {
		t.Fatal("ana nunca falou e conta como falando")
	}

	_ = s.SetSpeaking("call-1", "ana", true, t0.Add(time.Minute))
	_ = s.SetSpeaking("call-1", "ana", false, t0.Add(time.Minute+time.Second))
	_ = s.SetSpeaking("call-1", "ana", false, t0.Add(time.Minute+9*time.Second))
	if speaking(t0.Add(time.Minute + 12*time.Second)) {
		t.Fatal("o segundo 'parei' esticou a janela de fala")
	}
	if !speaking(t0.Add(time.Minute + 5*time.Second)) {
		t.Fatal("pausa curta depois de falar ainda conta")
	}
}
