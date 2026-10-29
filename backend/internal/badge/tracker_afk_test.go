package badge

import (
	"encoding/json"
	"testing"
	"time"

	"gin-quickstart/backend/internal/call"
)

// afkSource: uma call fixa (ana, bia, caio; entraram em t0) lida pelo
// call.AFK de verdade, como em produção.
type afkSource struct{ snap call.CallSnapshot }

func (f *afkSource) IsParticipant(callID, _ string) bool    { return callID == f.snap.CallID }
func (f *afkSource) ActiveVoiceUsers() []call.VoiceActivity { return nil }
func (f *afkSource) CallSnapshots() []call.CallSnapshot {
	s := f.snap
	return []call.CallSnapshot{s}
}

func everyoneEarning(t0 time.Time) call.CallSnapshot {
	ids := []string{"ana", "bia", "caio"}
	return call.CallSnapshot{
		CallID: "c1", Participants: ids, Listeners: ids, Voice: ids,
		ScreenSharers: []string{"bia"}, ScreenWatchers: []string{"ana", "caio"},
		JoinedAt: map[string]time.Time{"ana": t0, "bia": t0, "caio": t0},
	}
}

func TestTrackerStopsAfterTenMinutesWithoutSpeaking(t *testing.T) {
	now := t0
	afk := call.NewAFK(&afkSource{snap: everyoneEarning(t0)}, func() time.Time { return now })
	tr := newTracker(t0, time.UTC)
	speak := func(userID string) {
		afk.HandleSpeaking(userID, json.RawMessage(`{"call_id":"c1"}`))
	}

	// 15 min (23:59 → 00:14): a ana fala a cada 5 min; bia e caio, nunca.
	for i := 0; i < 90; i++ {
		if i%30 == 0 {
			speak("ana")
		}
		now = now.Add(tickInterval)
		tr.accrue(afk.CallSnapshots(), now)
	}
	d := tr.drain()
	// Madrugada é depois da meia-noite: 14 min para a ana, 9 para quem calou
	// (o tick dos 10:00 já não conta).
	if got := d["ana"].Night; got != 14*60 {
		t.Fatalf("ana (falando) night = %d s, want %d", got, 14*60)
	}
	if got := d["bia"].Night; got != 9*60-10 {
		t.Fatalf("bia (calada) night = %d s, want %d", got, 9*60-10)
	}
	if got := d["bia"].Stream; got != 10*60-10 {
		t.Fatalf("bia transmitindo calada = %d s, want %d", got, 10*60-10)
	}
	if got := d["caio"].Watch; got != 10*60-10 {
		t.Fatalf("caio assistindo calado = %d s, want %d", got, 10*60-10)
	}
	if got := d["ana"].Watch; got != 15*60 {
		t.Fatalf("ana assistindo e falando = %d s, want %d", got, 15*60)
	}
	// Maratona: AFK quebra a sessão, como mutar.
	if got := d["bia"].LongestSession; got != 10*60-10 {
		t.Fatalf("bia maratona = %d s, want %d", got, 10*60-10)
	}

	// Voltou a falar: conta de novo no próximo tick.
	speak("caio")
	now = now.Add(tickInterval)
	tr.accrue(afk.CallSnapshots(), now)
	if got := tr.drain()["caio"].Night; got != 10 {
		t.Fatalf("caio depois de falar = %d s, want 10", got)
	}
}

func TestTrackerAwayGetsNoCameraNorPeak(t *testing.T) {
	tr := newTracker(t0, time.UTC)
	ids := []string{"ana", "bia", "caio"}
	s := call.CallSnapshot{CallID: "c1", Participants: ids, Listeners: ids, Away: []string{"caio"}}
	tr.setCameras(map[string]bool{"ana": true, "caio": true})
	runTicks(tr, t0, 3, s)

	d := tr.drain()
	if d["ana"].Camera != 30 || d["caio"].Camera != 0 {
		t.Fatalf("câmera ana %d / caio (AFK) %d, want 30/0", d["ana"].Camera, d["caio"].Camera)
	}
	if d["ana"].PeakCallSize != 2 || d["caio"].PeakCallSize != 0 {
		t.Fatalf("pico ana %d / caio (AFK) %d, want 2/0", d["ana"].PeakCallSize, d["caio"].PeakCallSize)
	}
}

func TestTrackerPeakCountsOnlyRealAccounts(t *testing.T) {
	tr := newTracker(t0, time.UTC)
	ids := []string{"a", "b", "c", "d", "e"}
	tr.setRealAccounts(map[string]bool{"a": true, "b": true, "c": true})
	runTicks(tr, t0, 1, snap("c1", ids, nil, nil))

	d := tr.drain()
	if d["a"].PeakCallSize != 3 {
		t.Fatalf("pico = %d, want 3 (d e e não são contas reais)", d["a"].PeakCallSize)
	}
	if d["d"].PeakCallSize != 0 {
		t.Fatalf("conta não real levou pico %d, want 0", d["d"].PeakCallSize)
	}

	// Só uma conta real na call: não há festa.
	tr.setRealAccounts(map[string]bool{"a": true})
	runTicks(tr, t0.Add(tickInterval), 1, snap("c1", ids, nil, nil))
	if got := tr.drain()["a"].PeakCallSize; got != 0 {
		t.Fatalf("pico com uma conta real = %d, want 0", got)
	}
}
