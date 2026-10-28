package call

import (
	"encoding/json"
	"sync"
	"time"
)

// AFK em call: quem passa 10 minutos sem falar para de contar tempo de call
// (XP de voz e badges) até voltar a falar. A fala vem do próprio app
// ("call:speaking", ver docs/adr/0010-afk-em-call.md): o LiveKit não avisa o
// servidor de quem está falando.

const (
	// AFKAfter: tempo sem falar (desde a última fala, a entrada na call ou o
	// boot do servidor, o que for mais recente) para virar AFK.
	AFKAfter = 10 * time.Minute
	// speechReportEvery: no máximo um aviso de fala aceito por pessoa nesse
	// intervalo (o app manda um a cada 15 s enquanto fala).
	speechReportEvery = 10 * time.Second
)

// afkSource é o call.Service: quem está em cada call e as fotos sem filtro.
type afkSource interface {
	IsParticipant(callID, userID string) bool
	ActiveVoiceUsers() []VoiceActivity
	CallSnapshots() []CallSnapshot
}

// AFK guarda a última fala de cada um e entrega as fotos das calls (XP e
// badges) sem quem está AFK.
type AFK struct {
	src afkSource
	now func() time.Time
	// since: boot. A última fala não sobrevive a um deploy; quem já estava
	// na call ganha 10 min a partir daqui em vez de virar AFK na hora.
	since time.Time

	mu    sync.Mutex
	spoke map[string]time.Time
}

// NewAFK monta o AFK sobre o serviço de chamadas. now = time.Now em produção.
func NewAFK(src afkSource, now func() time.Time) *AFK {
	return &AFK{src: src, now: now, since: now(), spoke: make(map[string]time.Time)}
}

// HandleSpeaking trata o "call:speaking" de userID ({"call_id": "..."}).
// Inválido, de quem não está na call ou rápido demais: ignorado em silêncio.
func (a *AFK) HandleSpeaking(userID string, payload json.RawMessage) {
	var p struct {
		CallID string `json:"call_id"`
	}
	if err := json.Unmarshal(payload, &p); err != nil || p.CallID == "" {
		return
	}
	a.report(p.CallID, userID)
}

// report registra a fala; false se recusou (fora da call ou throttle).
func (a *AFK) report(callID, userID string) bool {
	if !a.src.IsParticipant(callID, userID) {
		return false
	}
	now := a.now()
	a.mu.Lock()
	defer a.mu.Unlock()
	if last, ok := a.spoke[userID]; ok && now.Sub(last) < speechReportEvery {
		return false
	}
	a.spoke[userID] = now
	return true
}

// awayLocked: está há AFKAfter sem falar, contando da entrada (joinedAt) e
// do boot.
func (a *AFK) awayLocked(userID string, joinedAt, now time.Time) bool {
	last := a.since
	if joinedAt.After(last) {
		last = joinedAt
	}
	if spoke := a.spoke[userID]; spoke.After(last) {
		last = spoke
	}
	return now.Sub(last) >= AFKAfter
}

// pruneLocked esquece falas velhas: elas já não tiram ninguém do AFK.
func (a *AFK) pruneLocked(now time.Time) {
	for userID, at := range a.spoke {
		if now.Sub(at) >= AFKAfter {
			delete(a.spoke, userID)
		}
	}
}
