package music

import (
	"context"
	"errors"
	"testing"
	"time"
)

type fakeClock struct{ now time.Time }

func (c *fakeClock) Now() time.Time        { return c.now }
func (c *fakeClock) Sleep(d time.Duration) { c.now = c.now.Add(d) }

type countSource struct{ n int }

func (s *countSource) ReadFrame(dst []float32) {
	s.n++
	for i := range dst {
		dst[i] = 0.5
	}
}

// limitWriter para depois de N frames e registra o adiantamento máximo.
type limitWriter struct {
	clk      *fakeClock
	start    time.Time
	frames   int
	limit    int
	maxAhead time.Duration
}

func (w *limitWriter) Write(p []byte) (int, error) {
	if len(p) != FrameLen*4 {
		return 0, errors.New("frame com tamanho errado")
	}
	w.frames++
	audio := time.Duration(w.frames) * FrameDuration
	if ahead := audio - w.clk.now.Sub(w.start); ahead > w.maxAhead {
		w.maxAhead = ahead
	}
	if w.frames >= w.limit {
		return 0, errors.New("chega")
	}
	return len(p), nil
}

func TestPumpStaysWithinLead(t *testing.T) {
	clk := &fakeClock{now: time.Unix(1000, 0)}
	w := &limitWriter{clk: clk, start: clk.now, limit: 500}
	src := &countSource{}
	err := Pump(context.Background(), src, w, clk, 200*time.Millisecond)
	if err == nil || src.n != 500 {
		t.Fatalf("err=%v frames=%d", err, src.n)
	}
	if w.maxAhead > 200*time.Millisecond+FrameDuration {
		t.Fatalf("adiantou %v (máx 220ms)", w.maxAhead)
	}
	// 500 frames = 10 s de áudio: o relógio andou ~9,8 s.
	if got := clk.now.Sub(time.Unix(1000, 0)); got < 9700*time.Millisecond {
		t.Fatalf("relógio andou só %v", got)
	}
}
