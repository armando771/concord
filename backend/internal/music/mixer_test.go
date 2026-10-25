package music

import (
	"bytes"
	"encoding/binary"
	"io"
	"math"
	"testing"
	"testing/iotest"
	"time"
)

// pcm gera f32le estéreo constante.
func pcm(seconds float64, v float32) []byte {
	n := int(seconds*SampleRate) * Channels
	b := make([]byte, n*4)
	for i := 0; i < n; i++ {
		binary.LittleEndian.PutUint32(b[i*4:], math.Float32bits(v))
	}
	return b
}

type closer struct {
	io.Reader
	closed bool
}

func (c *closer) Close() error { c.closed = true; return nil }

func src(seconds float64, v float32) *closer {
	return &closer{Reader: bytes.NewReader(pcm(seconds, v))}
}

type recorder struct{ events []MixEvent }

func (r *recorder) on(e MixEvent) { r.events = append(r.events, e) }

// frameAt diz em que frame (20 ms) o evento apareceu.
func run(m *Mixer, frames int, rec *recorder) (marks map[string]int, out [][]float32) {
	marks = map[string]int{}
	for i := 0; i < frames; i++ {
		before := len(rec.events)
		f := make([]float32, FrameLen)
		m.ReadFrame(f)
		out = append(out, f)
		for _, e := range rec.events[before:] {
			key := map[EventKind]string{EventStarted: "start:", EventEnded: "end:"}[e.Kind] + e.Tag
			marks[key] = i
		}
	}
	return marks, out
}

func TestFadeGainsEqualPower(t *testing.T) {
	for _, tt := range []float64{0, 0.25, 0.5, 0.75, 1} {
		o, i := fadeGains(tt)
		if math.Abs(o*o+i*i-1) > 1e-9 {
			t.Fatalf("t=%v: %v² + %v² != 1", tt, o, i)
		}
	}
	if o, i := fadeGains(0); o != 1 || i != 0 {
		t.Fatalf("início: %v %v", o, i)
	}
}

func TestSingleTrackPlaysAndEnds(t *testing.T) {
	rec := &recorder{}
	m := NewMixer(5*time.Second, time.Second, rec.on)
	a := src(1, 0.5)
	m.SetNext("a", a)
	if m.Idle() {
		t.Fatal("deveria estar tocando")
	}
	marks, out := run(m, 60, rec)
	if marks["start:a"] != 0 {
		t.Fatalf("start = %v", marks)
	}
	if out[10][0] != 0.5 || out[10][1] != 0.5 {
		t.Fatalf("amostra = %v", out[10][:2])
	}
	if _, ok := marks["end:a"]; !ok || !a.closed || !m.Idle() {
		t.Fatalf("fim: marks=%v closed=%v idle=%v", marks, a.closed, m.Idle())
	}
}

func TestCrossfadeTiming(t *testing.T) {
	rec := &recorder{}
	m := NewMixer(5*time.Second, time.Second, rec.on)
	m.SetNext("a", src(10, 0.5))
	m.SetNext("b", src(10, 0.5))
	marks, out := run(m, 800, rec)
	// 10 s = 500 frames; o crossfade de 5 s começa no frame 250.
	if marks["start:b"] != 250 {
		t.Fatalf("start:b = %d", marks["start:b"])
	}
	if marks["end:a"] != 499 {
		t.Fatalf("end:a = %d", marks["end:a"])
	}
	// No meio do crossfade: 0.5*(cos+sin) ≈ 0.707 (equal-power, sem clipe).
	mid := out[375][0]
	if mid < 0.69 || mid > 0.72 {
		t.Fatalf("meio do crossfade = %v", mid)
	}
}

func TestShortTrackShortCrossfade(t *testing.T) {
	rec := &recorder{}
	m := NewMixer(5*time.Second, time.Second, rec.on)
	m.SetNext("a", src(4, 0.5)) // 4 s → crossfade de 2 s
	m.SetNext("b", src(4, 0.5))
	marks, _ := run(m, 400, rec)
	if marks["start:b"] != 100 {
		t.Fatalf("start:b = %d", marks["start:b"])
	}
}

func TestSkipWithoutNextFadesToSilence(t *testing.T) {
	rec := &recorder{}
	m := NewMixer(5*time.Second, time.Second, rec.on)
	m.SetNext("a", src(30, 0.5))
	run(m, 10, rec)
	m.Skip()
	marks, out := run(m, 80, rec)
	if marks["end:a"] != 49 {
		t.Fatalf("end:a = %d", marks["end:a"])
	}
	if out[60][0] != 0 || !m.Idle() {
		t.Fatalf("depois do fade: %v idle=%v", out[60][0], m.Idle())
	}
}

func TestSkipWithNextStartsImmediately(t *testing.T) {
	rec := &recorder{}
	m := NewMixer(5*time.Second, time.Second, rec.on)
	m.SetNext("a", src(30, 0.5))
	m.SetNext("b", src(30, 0.5))
	run(m, 10, rec)
	m.Skip()
	if last := rec.events[len(rec.events)-1]; last.Kind != EventStarted || last.Tag != "b" {
		t.Fatalf("eventos = %+v", rec.events)
	}
}

func TestPartialReads(t *testing.T) {
	rec := &recorder{}
	m := NewMixer(5*time.Second, time.Second, rec.on)
	m.SetNext("a", &closer{Reader: iotest.OneByteReader(bytes.NewReader(pcm(0.1, 0.25)))})
	_, out := run(m, 2, rec)
	if out[0][0] != 0.25 || out[0][FrameLen-1] != 0.25 {
		t.Fatalf("amostras = %v %v", out[0][0], out[0][FrameLen-1])
	}
}

func TestClearNextAndClose(t *testing.T) {
	rec := &recorder{}
	m := NewMixer(5*time.Second, time.Second, rec.on)
	a, b := src(30, 0.5), src(30, 0.5)
	m.SetNext("a", a)
	m.SetNext("b", b)
	m.ClearNext()
	if !b.closed || m.HasNext() {
		t.Fatal("ClearNext deve fechar a próxima")
	}
	m.Close()
	if !a.closed || !m.Idle() {
		t.Fatal("Close deve fechar tudo")
	}
}
