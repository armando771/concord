package badge

import (
	"testing"
	"time"

	"gin-quickstart/backend/internal/call"
)

// t0 cai às 23:59:00 no fuso dos testes (UTC, passado explicitamente).
var t0 = time.Date(2026, 10, 24, 23, 59, 0, 0, time.UTC)

// snap monta uma chamada em que ninguém está surdo (todos ouvem).
func snap(id string, participants []string, voice []string, sharers []string) call.CallSnapshot {
	return call.CallSnapshot{CallID: id, Participants: participants, Listeners: participants, Voice: voice, ScreenSharers: sharers}
}

func runTicks(tr *tracker, from time.Time, ticks int, snaps ...call.CallSnapshot) time.Time {
	now := from
	for i := 0; i < ticks; i++ {
		now = now.Add(tickInterval)
		tr.accrue(snaps, now)
	}
	return now
}

func TestTrackerCountsStreamOnlyWithAudience(t *testing.T) {
	tr := newTracker(t0, time.UTC)
	runTicks(tr, t0, 3, snap("c1", []string{"ana", "bia"}, nil, []string{"ana"}))
	runTicks(tr, t0.Add(30*time.Second), 3, snap("c2", []string{"caio"}, nil, []string{"caio"}))

	deltas := tr.drain()
	if got := deltas["ana"].Stream; got != 30 {
		t.Fatalf("ana stream = %d s, want 30", got)
	}
	if got := deltas["caio"].Stream; got != 0 {
		t.Fatalf("caio streamed alone and got %d s", got)
	}
}

func TestTrackerStreamNeedsSomeoneElseListening(t *testing.T) {
	// Transmitir para alguém surdo (ou AFK ensurdecido) não conta.
	tr := newTracker(t0, time.UTC)
	deafAudience := call.CallSnapshot{
		CallID: "c1", Participants: []string{"ana", "bia"}, Listeners: []string{"ana"}, ScreenSharers: []string{"ana"},
	}
	runTicks(tr, t0, 3, deafAudience)
	if got := tr.drain()["ana"].Stream; got != 0 {
		t.Fatalf("stream to a deafened audience = %d s, want 0", got)
	}

	// Quem transmite pode estar mutado ou surdo: basta mais alguém ouvindo.
	sharerDeaf := call.CallSnapshot{
		CallID: "c1", Participants: []string{"ana", "bia"}, Listeners: []string{"bia"}, ScreenSharers: []string{"ana"},
	}
	runTicks(tr, t0.Add(30*time.Second), 3, sharerDeaf)
	if got := tr.drain()["ana"].Stream; got != 30 {
		t.Fatalf("stream with bia listening = %d s, want 30", got)
	}
}

func TestTrackerSplitsNightAndMorningByServerHour(t *testing.T) {
	tr := newTracker(t0, time.UTC)
	voice := snap("c1", []string{"ana", "bia"}, []string{"ana"}, nil)
	// Cada tick conta pelo começo do intervalo: de 23:59 a 00:01 só o
	// minuto depois da meia-noite é madrugada.
	runTicks(tr, t0, 12, voice)
	if got := tr.drain()["ana"].Night; got != 60 {
		t.Fatalf("night = %d s, want 60", got)
	}

	tr = newTracker(time.Date(2026, 10, 25, 4, 59, 50, 0, time.UTC), time.UTC)
	runTicks(tr, time.Date(2026, 10, 25, 4, 59, 50, 0, time.UTC), 2, voice)
	d := tr.drain()["ana"]
	if d.Night != 10 || d.Morning != 10 {
		t.Fatalf("around 05:00 = night %d morning %d, want 10/10", d.Night, d.Morning)
	}

	tr = newTracker(time.Date(2026, 10, 25, 8, 0, 0, 0, time.UTC), time.UTC)
	runTicks(tr, time.Date(2026, 10, 25, 8, 0, 0, 0, time.UTC), 2, voice)
	if d := tr.drain()["ana"]; d.Night != 0 || d.Morning != 0 {
		t.Fatalf("at 08:00 = %+v, want nothing", d)
	}
}

func TestTrackerDefaultsToBrasiliaNotHostClock(t *testing.T) {
	// Servidor em UTC (VPS): 03:00 UTC é meia-noite em Brasília.
	saved := time.Local
	time.Local = time.UTC
	t.Cleanup(func() { time.Local = saved })

	start := time.Date(2026, 10, 25, 3, 0, 0, 0, time.UTC)
	tr := newTracker(start, nil)
	runTicks(tr, start, 1, snap("c1", []string{"ana", "bia"}, []string{"ana"}, nil))
	if got := tr.drain()["ana"].Night; got != 10 {
		t.Fatalf("night at 00:00 BRT = %d, want 10", got)
	}

	// 08:00 UTC = 05:00 BRT: manhã, não madrugada.
	start = time.Date(2026, 10, 25, 8, 0, 0, 0, time.UTC)
	tr = newTracker(start, nil)
	runTicks(tr, start, 1, snap("c1", []string{"ana", "bia"}, []string{"ana"}, nil))
	if d := tr.drain()["ana"]; d.Night != 0 || d.Morning != 10 {
		t.Fatalf("at 05:00 BRT = %+v, want morning only", d)
	}
}

func TestTrackerPeakCallSizeAndSessions(t *testing.T) {
	tr := newTracker(t0, time.UTC)
	people := []string{"a", "b", "c", "d", "e"}
	five := snap("c1", people, people, nil)
	now := runTicks(tr, t0, 6, five) // 1 min com 5 pessoas
	d := tr.drain()
	if d["a"].PeakCallSize != 5 || d["e"].PeakCallSize != 5 {
		t.Fatalf("peak = %d/%d, want 5", d["a"].PeakCallSize, d["e"].PeakCallSize)
	}
	if d["a"].LongestSession != 60 {
		t.Fatalf("session = %d, want 60", d["a"].LongestSession)
	}

	// Continua na mesma call: a sessão segue somando entre os drains.
	now = runTicks(tr, now, 6, five)
	if got := tr.drain()["a"].LongestSession; got != 120 {
		t.Fatalf("session after 2 min = %d, want 120", got)
	}

	// "a" sai (some de um tick) e volta: a sessão recomeça do zero.
	now = runTicks(tr, now, 1, snap("c1", []string{"b", "c"}, []string{"b", "c"}, nil))
	runTicks(tr, now, 3, five)
	if got := tr.drain()["a"].LongestSession; got != 30 {
		t.Fatalf("session after leaving = %d, want 30", got)
	}
}

func TestTrackerMarathonFollowsXPRules(t *testing.T) {
	// Dois AFK mutados e surdos não fazem maratona: só conta o tempo "de
	// voz" (sem mute, sem surdo, com mais alguém ouvindo).
	tr := newTracker(t0, time.UTC)
	afk := call.CallSnapshot{CallID: "c1", Participants: []string{"ana", "bia"}}
	runTicks(tr, t0, 6, afk)
	if got := tr.drain()["ana"].LongestSession; got != 0 {
		t.Fatalf("AFK session = %d, want 0", got)
	}

	// Mutar quebra a sequência.
	talking := snap("c1", []string{"ana", "bia"}, []string{"ana", "bia"}, nil)
	muted := snap("c1", []string{"ana", "bia"}, []string{"bia"}, nil)
	now := runTicks(tr, t0.Add(time.Minute), 6, talking)
	now = runTicks(tr, now, 1, muted)
	runTicks(tr, now, 3, talking)
	if got := tr.drain()["ana"].LongestSession; got != 60 {
		t.Fatalf("longest = %d, want the 60 s before muting", got)
	}
}

func TestTrackerPartyCountsOnlyListeners(t *testing.T) {
	tr := newTracker(t0, time.UTC)
	party := call.CallSnapshot{
		CallID:       "c1",
		Participants: []string{"a", "b", "c", "d", "e", "f"},
		Listeners:    []string{"a", "b", "c", "d"},
	}
	runTicks(tr, t0, 1, party)
	d := tr.drain()
	if d["a"].PeakCallSize != 4 {
		t.Fatalf("peak = %d, want 4 (two deafened don't count)", d["a"].PeakCallSize)
	}
	if d["f"].PeakCallSize != 0 {
		t.Fatalf("deafened f got peak %d, want 0", d["f"].PeakCallSize)
	}
}

func TestTrackerSessionNeedsCompany(t *testing.T) {
	tr := newTracker(t0, time.UTC)
	runTicks(tr, t0, 6, snap("c1", []string{"ana"}, nil, nil))
	if got := tr.drain()["ana"].LongestSession; got != 0 {
		t.Fatalf("alone in call session = %d, want 0", got)
	}
}

func TestTrackerSessionsSurviveARestart(t *testing.T) {
	// O processo novo recebe a sessão que o antigo gravou ao desligar.
	tr := newTracker(t0, time.UTC)
	tr.resumeSessions(map[string]time.Duration{"ana": 3 * time.Hour})
	runTicks(tr, t0, 6, snap("c1", []string{"ana", "bia"}, []string{"ana", "bia"}, nil))
	if got := tr.drain()["ana"].LongestSession; got != 3*60*60+60 {
		t.Fatalf("resumed session = %d, want 3h + 60s", got)
	}
	if got := tr.activeSessions()["ana"]; got != 3*time.Hour+time.Minute {
		t.Fatalf("active session = %v", got)
	}
}

func TestTrackerStallDoesNotGrantMissedTime(t *testing.T) {
	tr := newTracker(t0, time.UTC)
	tr.accrue([]call.CallSnapshot{snap("c1", []string{"ana", "bia"}, nil, []string{"ana"})}, t0.Add(10*time.Minute))
	if got := tr.drain()["ana"].Stream; got != int64(tickInterval/time.Second) {
		t.Fatalf("stream after stall = %d, want one tick", got)
	}
}

func TestTrackerDrainEmptiesAndKeepsFractions(t *testing.T) {
	tr := newTracker(t0, time.UTC)
	sharing := snap("c1", []string{"ana", "bia"}, nil, []string{"ana"})
	tr.accrue([]call.CallSnapshot{sharing}, t0.Add(1500*time.Millisecond))
	if got := tr.drain()["ana"].Stream; got != 1 {
		t.Fatalf("stream = %d, want 1 (the half second waits)", got)
	}
	tr.accrue([]call.CallSnapshot{sharing}, t0.Add(2*time.Second))
	if got := tr.drain()["ana"].Stream; got != 1 {
		t.Fatalf("stream = %d, want 1 (0.5 + 0.5)", got)
	}
	if d := tr.drain(); len(d) != 0 {
		t.Fatalf("second drain = %+v, want empty", d)
	}
}

func TestTrackerRestoreGivesBackAFailedDelta(t *testing.T) {
	tr := newTracker(t0, time.UTC)
	tr.restore("ana", Delta{Stream: 30, Night: 5, PeakCallSize: 7, LongestSession: 90})
	tr.restore("ana", Delta{Stream: 10, PeakCallSize: 3})
	d := tr.drain()["ana"]
	if d.Stream != 40 || d.Night != 5 || d.PeakCallSize != 7 || d.LongestSession != 90 {
		t.Fatalf("restored delta = %+v", d)
	}
}

func TestTrackerCountsWatchTimeForListeningWatchers(t *testing.T) {
	// O snapshot já tira quem assiste à própria live e repete quem vê duas.
	tr := newTracker(t0, time.UTC)
	live := call.CallSnapshot{
		CallID:         "c1",
		Participants:   []string{"ana", "bia", "caio"},
		Listeners:      []string{"ana", "bia"},
		ScreenSharers:  []string{"ana"},
		ScreenWatchers: []string{"bia", "caio"},
	}
	runTicks(tr, t0, 3, live)

	deltas := tr.drain()
	if got := deltas["bia"].Watch; got != 30 {
		t.Fatalf("bia watch = %d s, want 30", got)
	}
	// Surdo (ou AFK ensurdecido) não conta como plateia.
	if got := deltas["caio"].Watch; got != 0 {
		t.Fatalf("caio watched deafened and got %d s", got)
	}
	if got := deltas["ana"].Watch; got != 0 {
		t.Fatalf("ana (streaming) got %d s of watch", got)
	}
}

func TestTrackerRestoresWatchTime(t *testing.T) {
	tr := newTracker(t0, time.UTC)
	tr.restore("bia", Delta{Watch: 42})
	if got := tr.drain()["bia"].Watch; got != 42 {
		t.Fatalf("restored watch = %d s, want 42", got)
	}
}
