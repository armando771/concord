package call

import (
	"encoding/json"
	"reflect"
	"testing"
	"time"
)

var afkT0 = time.Date(2026, 10, 27, 20, 0, 0, 0, time.UTC)

type fakeClock struct{ t time.Time }

func (c *fakeClock) now() time.Time          { return c.t }
func (c *fakeClock) advance(d time.Duration) { c.t = c.t.Add(d) }

// afkCall: ana, bia e caio entraram em afkT0 numa call ativa; o AFK subiu
// antes (sem a folga do boot atrapalhar).
func afkCall(t *testing.T) (*AFK, *Service, *fakeClock) {
	t.Helper()
	s := serviceWithCall("call-1", "ana", "bia", "caio")
	for _, p := range s.calls["call-1"].participants {
		p.joinedAt = afkT0
	}
	clock := &fakeClock{t: afkT0.Add(-time.Hour)}
	afk := NewAFK(s, clock.now)
	clock.t = afkT0
	return afk, s, clock
}

func speak(afk *AFK, userID, callID string) {
	payload, _ := json.Marshal(map[string]string{"call_id": callID})
	afk.HandleSpeaking(userID, payload)
}

func voiceIDs(active []VoiceActivity) []string {
	var ids []string
	for _, a := range active {
		ids = append(ids, a.UserID)
	}
	return ids
}

func TestAFKEntryCountsUntilTenMinutesWithoutSpeaking(t *testing.T) {
	afk, _, clock := afkCall(t)

	clock.advance(AFKAfter - time.Second)
	if got := voiceIDs(afk.ActiveVoiceUsers()); !reflect.DeepEqual(got, []string{"ana", "bia", "caio"}) {
		t.Fatalf("9:59 depois de entrar = %v, want os três", got)
	}

	clock.advance(time.Second)
	if got := afk.ActiveVoiceUsers(); len(got) != 0 {
		t.Fatalf("10 min sem falar = %v, want ninguém", voiceIDs(got))
	}
}

func TestAFKSpeakingKeepsCountingAndComingBackResumes(t *testing.T) {
	afk, _, clock := afkCall(t)

	clock.advance(5 * time.Minute)
	speak(afk, "ana", "call-1")
	clock.advance(9 * time.Minute) // 14 min de call, 9 desde a última fala da ana
	if got := voiceIDs(afk.ActiveVoiceUsers()); !reflect.DeepEqual(got, []string{"ana"}) {
		t.Fatalf("ativos = %v, want só a ana (falou há 9 min)", got)
	}

	clock.advance(time.Minute)
	if got := afk.ActiveVoiceUsers(); len(got) != 0 {
		t.Fatalf("ana 10 min calada = %v, want ninguém", voiceIDs(got))
	}

	speak(afk, "bia", "call-1")
	if got := voiceIDs(afk.ActiveVoiceUsers()); !reflect.DeepEqual(got, []string{"bia"}) {
		t.Fatalf("bia voltou a falar = %v, want bia na hora", got)
	}
}

func TestAFKBootGivesEveryoneTenMinutes(t *testing.T) {
	// Depois de um deploy a última fala some: quem já estava na call ganha
	// 10 min a partir do boot, em vez de virar AFK na hora.
	s := serviceWithCall("call-1", "ana", "bia")
	for _, p := range s.calls["call-1"].participants {
		p.joinedAt = afkT0
	}
	clock := &fakeClock{t: afkT0.Add(time.Hour)}
	afk := NewAFK(s, clock.now)

	clock.advance(AFKAfter - time.Second)
	if got := afk.ActiveVoiceUsers(); len(got) != 2 {
		t.Fatalf("logo após o boot = %v, want os dois", voiceIDs(got))
	}
	clock.advance(time.Second)
	if got := afk.ActiveVoiceUsers(); len(got) != 0 {
		t.Fatalf("10 min após o boot = %v, want ninguém", voiceIDs(got))
	}
}

func TestAFKIgnoresSpeechFromOutsideTheCall(t *testing.T) {
	afk, _, clock := afkCall(t)
	clock.advance(AFKAfter)

	speak(afk, "dani", "call-1") // não está na call
	speak(afk, "ana", "call-2")  // call errada
	afk.HandleSpeaking("ana", json.RawMessage(`"lixo"`))
	afk.HandleSpeaking("ana", json.RawMessage(`{}`))

	if got := afk.ActiveVoiceUsers(); len(got) != 0 {
		t.Fatalf("ativos = %v, want ninguém (nenhum aviso válido)", voiceIDs(got))
	}
	if len(afk.spoke) != 0 {
		t.Fatalf("guardou fala de quem não está na call: %v", afk.spoke)
	}
}

func TestAFKThrottlesReports(t *testing.T) {
	afk, _, clock := afkCall(t)

	if !afk.report("call-1", "ana") {
		t.Fatal("primeiro aviso recusado")
	}
	clock.advance(speechReportEvery - time.Second)
	if afk.report("call-1", "ana") {
		t.Fatal("aviso antes do intervalo foi aceito")
	}
	if got := afk.spoke["ana"]; !got.Equal(afkT0) {
		t.Fatalf("última fala = %v, want a do primeiro aviso", got)
	}
	clock.advance(time.Second)
	if !afk.report("call-1", "ana") {
		t.Fatal("aviso depois do intervalo recusado")
	}
}

func TestAFKSnapshotsMarkAwayAndDropTheirEarnings(t *testing.T) {
	afk, s, clock := afkCall(t)
	s.screenSharers = map[string]map[string]struct{}{"call-1": {"ana": {}, "bia": {}}}
	s.calls["call-1"].screenWatchers = map[string]map[string]struct{}{"ana": {"caio": {}}, "bia": {"caio": {}}}

	clock.advance(8 * time.Minute)
	speak(afk, "bia", "call-1")
	clock.advance(2 * time.Minute)

	snaps := afk.CallSnapshots()
	if len(snaps) != 1 {
		t.Fatalf("snapshots = %d", len(snaps))
	}
	got := snaps[0]
	if !reflect.DeepEqual(got.Away, []string{"ana", "caio"}) {
		t.Fatalf("Away = %v, want ana e caio", got.Away)
	}
	if !reflect.DeepEqual(got.Voice, []string{"bia"}) || !reflect.DeepEqual(got.ScreenSharers, []string{"bia"}) || len(got.ScreenWatchers) != 0 {
		t.Fatalf("voz %v, tela %v, assistindo %v: want só a bia ganhando", got.Voice, got.ScreenSharers, got.ScreenWatchers)
	}
	// Quem está na call e ouvindo continua listado: os outros badges ("mais
	// alguém ouvindo") não mudam.
	if len(got.Participants) != 3 || len(got.Listeners) != 3 {
		t.Fatalf("participantes %v, ouvintes %v", got.Participants, got.Listeners)
	}
}

func TestAFKForgetsOldSpeech(t *testing.T) {
	afk, _, clock := afkCall(t)
	speak(afk, "ana", "call-1")
	clock.advance(AFKAfter)
	afk.CallSnapshots()
	if len(afk.spoke) != 0 {
		t.Fatalf("fala de 10 min atrás continua guardada: %v", afk.spoke)
	}
}

type recordedCallMessage struct{ userID, evType string }

type fakeCallRouter struct{ got []recordedCallMessage }

func (f *fakeCallRouter) HandleCallMessage(userID, evType string, _ json.RawMessage) {
	f.got = append(f.got, recordedCallMessage{userID, evType})
}
func (f *fakeCallRouter) IsParticipant(string, string) bool { return true }

func TestSpeakingRouterSendsSpeechToAFKAndTheRestToTheCall(t *testing.T) {
	afk, _, _ := afkCall(t)
	next := &fakeCallRouter{}
	router := afk.Router(next)

	router.HandleCallMessage("ana", "call:speaking", json.RawMessage(`{"call_id":"call-1"}`))
	router.HandleCallMessage("ana", "call:voice", json.RawMessage(`{}`))

	if _, ok := afk.spoke["ana"]; !ok {
		t.Fatal("call:speaking não chegou ao AFK")
	}
	if !reflect.DeepEqual(next.got, []recordedCallMessage{{"ana", "call:voice"}}) {
		t.Fatalf("repassadas = %v, want só call:voice", next.got)
	}
	if !router.IsParticipant("call-1", "ana") {
		t.Fatal("IsParticipant não repassado")
	}
}
