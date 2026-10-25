package music

import (
	"encoding/binary"
	"io"
	"math"
	"sync"
	"time"
)

const (
	SampleRate    = 48000
	Channels      = 2
	FrameSamples  = 960 // 20 ms por canal
	FrameLen      = FrameSamples * Channels
	FrameDuration = 20 * time.Millisecond
)

type EventKind int

const (
	EventStarted EventKind = iota + 1
	EventEnded
)

type MixEvent struct {
	Kind EventKind
	Tag  string
}

// FrameSource entrega 20 ms de áudio (FrameLen floats, estéreo intercalado).
type FrameSource interface {
	ReadFrame(dst []float32)
}

// fadeGains: curva equal-power (cos/sin), a energia somada fica constante.
func fadeGains(t float64) (out, in float64) {
	if t < 0 {
		t = 0
	}
	if t > 1 {
		t = 1
	}
	return math.Cos(t * math.Pi / 2), math.Sin(t * math.Pi / 2)
}

// mixTrack lê PCM f32le de uma faixa, com um buffer de antecedência.
type mixTrack struct {
	tag    string
	r      io.ReadCloser
	buf    []float32
	rem    []byte // bytes de um float que chegou pela metade
	raw    []byte
	eof    bool
	played int // amostras por canal já tocadas
}

func newMixTrack(tag string, r io.ReadCloser) *mixTrack {
	return &mixTrack{tag: tag, r: r, raw: make([]byte, 32*1024)}
}

// readOnce faz uma única leitura (bloqueante) e decodifica o que veio.
func (t *mixTrack) readOnce() {
	n, err := t.r.Read(t.raw)
	data := append(t.rem, t.raw[:n]...)
	whole := len(data) / 4 * 4
	for i := 0; i < whole; i += 4 {
		t.buf = append(t.buf, math.Float32frombits(binary.LittleEndian.Uint32(data[i:])))
	}
	t.rem = append([]byte(nil), data[whole:]...)
	if err != nil {
		t.eof = true
	}
}

// fill lê até ter want floats no buffer (ou até o fim da faixa). Faz I/O:
// só a goroutine de ReadFrame chama, e nunca com o lock.
func (t *mixTrack) fill(want int) {
	for len(t.buf) < want && !t.eof {
		t.readOnce()
	}
}

// take tira até n floats do começo do buffer, sem I/O (o ReadFrame já encheu).
func (t *mixTrack) take(n int) []float32 {
	if n > len(t.buf) {
		n = len(t.buf)
	}
	out := t.buf[:n:n]
	t.buf = t.buf[n:]
	t.played += n / Channels
	return out
}

func (t *mixTrack) remaining() int { return len(t.buf) / Channels }

type fadeState struct {
	out   *mixTrack // faixa saindo (pode terminar antes do fade)
	total int       // amostras por canal
	pos   int
}

// Mixer junta a faixa atual e a próxima em frames de 20 ms. Uma goroutine
// lê (ReadFrame); outra comanda (SetNext/Skip/...). Os eventos saem fora do lock.
type Mixer struct {
	mu        sync.Mutex
	cur       *mixTrack
	next      *mixTrack
	fade      *fadeState
	crossfade int
	skipFade  int
	onEvent   func(MixEvent)
}

func NewMixer(crossfade, skipFade time.Duration, onEvent func(MixEvent)) *Mixer {
	return &Mixer{
		crossfade: int(crossfade.Seconds() * SampleRate),
		skipFade:  int(skipFade.Seconds() * SampleRate),
		onEvent:   onEvent,
	}
}

func (m *Mixer) emit(events []MixEvent) {
	for _, e := range events {
		if m.onEvent != nil {
			m.onEvent(e)
		}
	}
}

// closeAll fecha leitores fora do lock: o Close de um pipe pode demorar e é
// ele que destrava um Read parado.
func closeAll(rs []io.Closer) {
	for _, r := range rs {
		_ = r.Close()
	}
}

func (m *Mixer) SetNext(tag string, r io.ReadCloser) {
	m.mu.Lock()
	var events []MixEvent
	var toClose []io.Closer
	t := newMixTrack(tag, r)
	if m.cur == nil && m.fade == nil {
		m.cur = t
		events = append(events, MixEvent{EventStarted, tag})
	} else {
		if m.next != nil {
			toClose = append(toClose, m.next.r)
		}
		m.next = t
	}
	m.mu.Unlock()
	closeAll(toClose)
	m.emit(events)
}

func (m *Mixer) ClearNext() {
	m.mu.Lock()
	var toClose []io.Closer
	if m.next != nil {
		toClose = append(toClose, m.next.r)
		m.next = nil
	}
	m.mu.Unlock()
	closeAll(toClose)
}

func (m *Mixer) HasNext() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.next != nil
}

func (m *Mixer) Idle() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.cur == nil && m.fade == nil && m.next == nil
}

// Skip faz a atual sumir em skipFade; a próxima (se houver) entra já.
func (m *Mixer) Skip() {
	m.mu.Lock()
	var events []MixEvent
	var toClose []io.Closer
	if m.fade != nil {
		toClose = append(toClose, m.fade.out.r)
		events = append(events, MixEvent{EventEnded, m.fade.out.tag})
		m.fade = nil
	}
	if m.cur != nil {
		m.fade = &fadeState{out: m.cur, total: m.skipFade}
		m.cur = m.next
		m.next = nil
		if m.cur != nil {
			events = append(events, MixEvent{EventStarted, m.cur.tag})
		}
	}
	m.mu.Unlock()
	closeAll(toClose)
	m.emit(events)
}

func (m *Mixer) Close() {
	m.mu.Lock()
	var toClose []io.Closer
	for _, t := range []*mixTrack{m.cur, m.next} {
		if t != nil {
			toClose = append(toClose, t.r)
		}
	}
	if m.fade != nil {
		toClose = append(toClose, m.fade.out.r)
	}
	m.cur, m.next, m.fade = nil, nil, nil
	m.mu.Unlock()
	closeAll(toClose)
}

func (m *Mixer) ReadFrame(dst []float32) {
	// Fase 1: só olha o estado; o I/O (que pode parar) roda sem o lock.
	m.mu.Lock()
	cur, next := m.cur, m.next
	var fadeOut *mixTrack
	if m.fade != nil {
		fadeOut = m.fade.out
	}
	ahead := m.crossfade*Channels + FrameLen
	m.mu.Unlock()
	// Só esta goroutine mexe no buffer das faixas, então encher fora do lock é seguro.
	if fadeOut != nil {
		fadeOut.fill(FrameLen)
	}
	if cur != nil {
		cur.fill(FrameLen)
		// O crossfade só começa depois de ver o EOF. O lookahead cresce no máximo
		// uma leitura por frame (evita um pico de ~2 MB num único frame de 20 ms).
		if next != nil && len(cur.buf) < ahead && !cur.eof {
			cur.readOnce()
		}
	}
	if next != nil {
		next.fill(FrameLen)
	}

	// Fase 2: decide e mistura, sem I/O.
	m.mu.Lock()
	var events []MixEvent
	var toClose []io.Closer
	for i := range dst {
		dst[i] = 0
	}

	// Ninguém tocando (fade de skip em andamento) e chegou uma próxima: entra já.
	if m.cur == nil && m.next != nil {
		m.cur, m.next = m.next, nil
		events = append(events, MixEvent{EventStarted, m.cur.tag})
	}

	// Perto do fim da atual, com próxima pronta: começa o crossfade.
	if m.fade == nil && m.cur != nil && m.cur.eof {
		rem := m.cur.remaining()
		if m.next != nil {
			xf := m.crossfade
			if half := (m.cur.played + rem) / 2; half < xf {
				xf = half
			}
			if rem <= xf {
				m.fade = &fadeState{out: m.cur, total: rem}
				m.cur, m.next = m.next, nil
				events = append(events, MixEvent{EventStarted, m.cur.tag})
			}
		} else if rem == 0 {
			toClose = append(toClose, m.cur.r)
			events = append(events, MixEvent{EventEnded, m.cur.tag})
			m.cur = nil
		}
	}

	if f := m.fade; f != nil {
		out := f.out.take(FrameLen)
		var in []float32
		if m.cur != nil {
			in = m.cur.take(FrameLen)
		}
		for s := 0; s < FrameSamples; s++ {
			gOut, gIn := fadeGains(float64(f.pos+s) / float64(max(f.total, 1)))
			for c := 0; c < Channels; c++ {
				i := s*Channels + c
				var v float64
				if i < len(out) && f.pos+s < f.total {
					v += float64(out[i]) * gOut
				}
				if i < len(in) {
					v += float64(in[i]) * gIn
				}
				dst[i] = float32(v)
			}
		}
		f.pos += FrameSamples
		if f.pos >= f.total || (f.out.eof && f.out.remaining() == 0) {
			toClose = append(toClose, f.out.r)
			events = append(events, MixEvent{EventEnded, f.out.tag})
			m.fade = nil
		}
	} else if m.cur != nil {
		copy(dst, m.cur.take(FrameLen))
	}

	for i, v := range dst {
		if v > 1 {
			dst[i] = 1
		} else if v < -1 {
			dst[i] = -1
		}
	}
	m.mu.Unlock()
	closeAll(toClose)
	m.emit(events)
}
