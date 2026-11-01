package music

// Badge DJ: conta a música que tocou de verdade, não a que entrou na fila
// (uma playlist de 5000 dava o tier máximo). Ela precisa tocar playedAfter
// sem ser pulada e, nesse momento, alguém além de quem pediu precisa estar
// ouvindo na call (sem estar surdo), como nos outros badges de call.

import "time"

const playedAfter = 30 * time.Second

// armPlayedLocked: a faixa começou a tocar agora. Retomada depois de
// reiniciar (ResumeAt) conta só o que falta: passada do tempo, já contou.
func (p *Player) armPlayedLocked(it *Item) {
	after := p.deps.PlayedAfter
	if after <= 0 {
		after = playedAfter
	}
	if after -= it.ResumeAt; after <= 0 {
		return
	}
	time.AfterFunc(after, func() { p.creditPlayed(it) })
}

// creditPlayed: passou o tempo; conta se a faixa continua tocando e não foi
// pulada (o skip já emitido também não conta, mesmo no fade).
func (p *Player) creditPlayed(it *Item) {
	p.mu.Lock()
	playing := !p.closed && p.now == it && p.skipped != it.ID
	p.mu.Unlock()
	if playing {
		p.deps.Notify.Played(p.CallID, it.RequestedBy.ID)
	}
}

// Played: a música de userID tocou o bastante na call; conta no DJ se mais
// alguém está ouvindo.
func (n *notifier) Played(callID, userID string) {
	if n.deps.Listeners == nil || !othersListening(n.deps.Listeners(callID), userID) {
		return
	}
	(*Manager)(n).reportPlayed(userID)
}

func othersListening(listeners []string, userID string) bool {
	for _, id := range listeners {
		if id != userID {
			return true
		}
	}
	return false
}

// OnPlayed registra quem quer saber das músicas que tocaram (badge DJ).
func (m *Manager) OnPlayed(fn func(userID string)) {
	m.mu.Lock()
	m.onPlayed = fn
	m.mu.Unlock()
}

func (m *Manager) reportPlayed(userID string) {
	m.mu.Lock()
	fn := m.onPlayed
	m.mu.Unlock()
	if fn != nil {
		fn(userID)
	}
}
