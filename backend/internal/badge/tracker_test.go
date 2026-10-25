package badge

import (
	"testing"
	"time"

	"gin-quickstart/backend/internal/call"
)

// t0 cai às 23:59:00 no horário do servidor (UTC nos testes).
var t0 = time.Date(2026, 10, 24, 23, 59, 0, 0, time.UTC)

func snap(id string, participants []string, voice []string, sharers []string) call.CallSnapshot {
	return call.CallSnapshot{CallID: id, Participants: participants, Voice: voice, ScreenSharers: sharers}
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
	if _, ok := deltas["caio"]; ok && deltas["caio"].Stream != 0 {
		t.Fatalf("caio streamed alone and got %d s", deltas["caio"].Stream)
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

func TestTrackerUsesTheConfiguredZone(t *testing.T) {
	// 03:00 UTC = 00:00 em São Paulo.
	sp := time.FixedZone("BRT", -3*60*60)
	start := time.Date(2026, 10, 25, 3, 0, 0, 0, time.UTC)
	tr := newTracker(start, sp)
	runTicks(tr, start, 1, snap("c1", []string{"ana", "bia"}, []string{"ana"}, nil))
	if got := tr.drain()["ana"].Night; got != 10 {
		t.Fatalf("night = %d, want 10", got)
	}
}

func TestTrackerPeakCallSizeAndSessions(t *testing.T) {
	tr := newTracker(t0, time.UTC)
	five := snap("c1", []string{"a", "b", "c", "d", "e"}, nil, nil)
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
	now = runTicks(tr, now, 1, snap("c1", []string{"b", "c"}, nil, nil))
	runTicks(tr, now, 3, five)
	if got := tr.drain()["a"].LongestSession; got != 30 {
		t.Fatalf("session after leaving = %d, want 30", got)
	}
}

func TestTrackerSessionNeedsCompany(t *testing.T) {
	tr := newTracker(t0, time.UTC)
	runTicks(tr, t0, 6, snap("c1", []string{"ana"}, nil, nil))
	if got := tr.drain()["ana"].LongestSession; got != 0 {
		t.Fatalf("alone in call session = %d, want 0", got)
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
