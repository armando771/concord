package music

// Timer de ociosidade: sem nada tocando, na fila nem sendo preparado, o
// Maestro sai da call depois de IdleTimeout. Extraído do player.go.

import "time"

// idleIfEmptyLocked arma o timer quando não há nada tocando, na fila nem sendo preparado.
func (p *Player) idleIfEmptyLocked() {
	if p.now == nil && p.queue.Len() == 0 && len(p.preparing) == 0 {
		p.startIdleLocked()
	}
}

func (p *Player) startIdleLocked() {
	if p.idle != nil {
		return
	}
	var t *time.Timer
	t = time.AfterFunc(p.deps.IdleTimeout, func() {
		// Se o timer foi parado/substituído enquanto esperava o lock, não fecha.
		p.mu.Lock()
		stale := p.idle != t
		p.mu.Unlock()
		if !stale {
			p.shutdown(false)
		}
	})
	p.idle = t
}

func (p *Player) stopIdleLocked() {
	if p.idle != nil {
		p.idle.Stop()
		p.idle = nil
	}
}

// IdleIfEmpty arma o timer de ociosidade se não há nada tocando nem na fila.
func (p *Player) IdleIfEmpty() {
	p.mu.Lock()
	defer p.mu.Unlock()
	if !p.closed {
		p.idleIfEmptyLocked()
	}
}
