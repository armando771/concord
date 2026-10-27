package badge

import (
	"time"
	_ "time/tzdata" // fuso de Brasília também no Windows e em contêineres sem tzdata

	"gin-quickstart/backend/internal/call"
)

// De quanto em quanto tempo o tracker olha as chamadas (o mesmo do XP).
const tickInterval = 10 * time.Second

// Delta é o que uma pessoa juntou desde o último drain. Tempos em segundos;
// PeakCallSize e LongestSession são máximos (o banco guarda o maior).
type Delta struct {
	Stream         int64
	Night          int64
	Morning        int64
	PeakCallSize   int64
	LongestSession int64
}

type pending struct {
	stream, night, morning time.Duration
	peak                   int64
	longest                time.Duration
}

// Brasilia é o fuso das horas de Coruja e Madrugador, fixo no código (o
// relógio da VPS costuma estar em UTC). Mesmo padrão dos aniversários.
func Brasilia() *time.Location {
	if loc, err := time.LoadLocation("America/Sao_Paulo"); err == nil {
		return loc
	}
	return time.FixedZone("BRT", -3*60*60)
}

// tracker soma, em memória, o que os badges de call precisam. Não sabe de
// banco: o serviço drena de tempos em tempos e grava.
type tracker struct {
	loc      *time.Location
	lastTick time.Time
	pending  map[string]*pending
	// sessions: tempo seguido de cada um numa call com mais alguém.
	sessions map[string]time.Duration
}

func newTracker(start time.Time, loc *time.Location) *tracker {
	if loc == nil {
		loc = Brasilia()
	}
	return &tracker{
		loc:      loc,
		lastTick: start,
		pending:  make(map[string]*pending),
		sessions: make(map[string]time.Duration),
	}
}

func (t *tracker) get(userID string) *pending {
	p, ok := t.pending[userID]
	if !ok {
		p = &pending{}
		t.pending[userID] = p
	}
	return p
}

// accrue soma o tempo desde o último tick. O intervalo conta pela hora em
// que começou (de 4:59:50 a 5:00:00 ainda é madrugada).
func (t *tracker) accrue(snaps []call.CallSnapshot, now time.Time) {
	elapsed := t.advance(now)
	hour := now.Add(-elapsed).In(t.loc).Hour()

	inSession := make(map[string]bool)
	for _, s := range snaps {
		t.accruePeak(s)
		t.accrueVoice(s, hour, elapsed, inSession)
		t.accrueStream(s, elapsed)
	}
	for userID := range t.sessions {
		if !inSession[userID] {
			delete(t.sessions, userID)
		}
	}
}

// advance anda o relógio do tracker e devolve o tempo desde o último tick.
func (t *tracker) advance(now time.Time) time.Duration {
	elapsed := now.Sub(t.lastTick)
	t.lastTick = now
	// Servidor travado/suspenso: não dá de uma vez o tempo que ninguém viu.
	if elapsed > 2*tickInterval || elapsed < 0 {
		elapsed = tickInterval
	}
	return elapsed
}

// accruePeak: Festeiro conta quantas pessoas estão ouvindo (surdo não
// conta), e só quem está ouvindo leva o crédito.
func (t *tracker) accruePeak(s call.CallSnapshot) {
	size := int64(len(s.Listeners))
	if size < 2 {
		return
	}
	for _, userID := range s.Listeners {
		p := t.get(userID)
		if size > p.peak {
			p.peak = size
		}
	}
}

// accrueVoice: Coruja, Madrugador e Maratona seguem o XP de voz: sem mute,
// sem surdo e com mais alguém ouvindo.
func (t *tracker) accrueVoice(s call.CallSnapshot, hour int, elapsed time.Duration, inSession map[string]bool) {
	for _, userID := range s.Voice {
		p := t.get(userID)
		switch {
		case hour < 5:
			p.night += elapsed
		case hour < 8:
			p.morning += elapsed
		}
		inSession[userID] = true
		t.sessions[userID] += elapsed
		if t.sessions[userID] > p.longest {
			p.longest = t.sessions[userID]
		}
	}
}

// accrueStream: Streamer precisa de mais alguém ouvindo (quem transmite pode
// estar mutado).
func (t *tracker) accrueStream(s call.CallSnapshot, elapsed time.Duration) {
	for _, userID := range s.ScreenSharers {
		if hasOtherListener(s.Listeners, userID) {
			t.get(userID).stream += elapsed
		}
	}
}

func hasOtherListener(listeners []string, userID string) bool {
	for _, id := range listeners {
		if id != userID {
			return true
		}
	}
	return false
}

// resumeSessions recebe as sessões de maratona que o processo anterior
// gravou ao desligar (deploy): quem continua em call não recomeça do zero.
func (t *tracker) resumeSessions(sessions map[string]time.Duration) {
	for userID, d := range sessions {
		if d > t.sessions[userID] {
			t.sessions[userID] = d
		}
	}
}

// activeSessions é uma cópia das sessões em andamento (para gravar).
func (t *tracker) activeSessions() map[string]time.Duration {
	out := make(map[string]time.Duration, len(t.sessions))
	for userID, d := range t.sessions {
		out[userID] = d
	}
	return out
}

// restore devolve um delta que não conseguiu ser gravado, para ir no
// próximo flush.
func (t *tracker) restore(userID string, d Delta) {
	p := t.get(userID)
	p.stream += time.Duration(d.Stream) * time.Second
	p.night += time.Duration(d.Night) * time.Second
	p.morning += time.Duration(d.Morning) * time.Second
	if d.PeakCallSize > p.peak {
		p.peak = d.PeakCallSize
	}
	if l := time.Duration(d.LongestSession) * time.Second; l > p.longest {
		p.longest = l
	}
}

func wholeSeconds(d *time.Duration) int64 {
	s := int64(*d / time.Second)
	*d -= time.Duration(s) * time.Second
	return s
}

// drain devolve o que foi juntado e zera. Frações de segundo ficam para o
// próximo; quem não juntou nada não aparece.
func (t *tracker) drain() map[string]Delta {
	out := make(map[string]Delta)
	for userID, p := range t.pending {
		d := Delta{
			Stream:         wholeSeconds(&p.stream),
			Night:          wholeSeconds(&p.night),
			Morning:        wholeSeconds(&p.morning),
			PeakCallSize:   p.peak,
			LongestSession: int64(p.longest / time.Second),
		}
		p.peak = 0
		p.longest = 0
		if p.stream == 0 && p.night == 0 && p.morning == 0 {
			delete(t.pending, userID)
		}
		if d != (Delta{}) {
			out[userID] = d
		}
	}
	return out
}
