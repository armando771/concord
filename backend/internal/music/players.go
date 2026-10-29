package music

// Os players do Manager: um por canal de voz, criado no primeiro pedido e
// fechado quando a call acaba ou o dono tira o Maestro. Extraído do manager.go.

import (
	"context"
	"path/filepath"
	"sort"
	"time"
)

// pendingPlayer: player conectando; quem chega junto espera em ready.
type pendingPlayer struct {
	ready chan struct{}
	p     *Player
	err   error
}

func (m *Manager) player(channelID string) *Player {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.players[channelID]
}

func (m *Manager) playerByCall(callID string) *Player {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, p := range m.players {
		if p.CallID == callID {
			return p
		}
	}
	return nil
}

// playerFor devolve o player do canal, criando (e entrando na sala) se preciso.
func (m *Manager) playerFor(ctx context.Context, loc Location) (*Player, error) {
	m.mu.Lock()
	if p, ok := m.players[loc.ChannelID]; ok {
		m.mu.Unlock()
		return p, nil
	}
	if pe, ok := m.pending[loc.ChannelID]; ok {
		// Outro comando já está conectando esse canal: espera o resultado.
		m.mu.Unlock()
		return pe.wait(ctx)
	}
	return m.startLocked(ctx, loc)
}

// newPlayerFor só cria: se o canal já tem player (ou está criando um),
// errChannelBusy. É o da retomada, que não mistura a fila salva na de quem
// pediu música agora.
func (m *Manager) newPlayerFor(ctx context.Context, loc Location) (*Player, error) {
	m.mu.Lock()
	if m.players[loc.ChannelID] != nil || m.pending[loc.ChannelID] != nil {
		m.mu.Unlock()
		return nil, errChannelBusy
	}
	return m.startLocked(ctx, loc)
}

func (pe *pendingPlayer) wait(ctx context.Context) (*Player, error) {
	select {
	case <-pe.ready:
		return pe.p, pe.err
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// startLocked cria o player e entra na sala; chamado com m.mu preso, solta.
func (m *Manager) startLocked(ctx context.Context, loc Location) (*Player, error) {
	if len(m.players)+len(m.pending) >= m.cfg.MaxPlayers {
		m.mu.Unlock()
		return nil, errTooManyPlayers
	}
	p := NewPlayer(loc.CallID, loc.ChannelID, loc.ServerID, m.deps.ChannelName(ctx, loc.ChannelID), PlayerDeps{
		Source: m.deps.Source, Prepare: m.deps.Prepare, NewOutput: m.deps.NewOutput,
		Notify: (*notifier)(m), Now: time.Now,
		CacheDir: filepath.Join(m.cfg.CacheDir, loc.ChannelID),
		QueueMax: m.cfg.QueueMax, IdleTimeout: m.cfg.IdleTimeout,
		Crossfade: crossfade, SkipFade: skipFade,
	})
	pe := &pendingPlayer{ready: make(chan struct{})}
	m.pending[loc.ChannelID] = pe // reserva a vaga; só entra em players depois de iniciado
	m.mu.Unlock()

	err := p.Start(context.Background())
	m.mu.Lock()
	delete(m.pending, loc.ChannelID)
	if err == nil && p.IsClosed() {
		// Caiu entre o Start e a inserção: não deixa uma entrada morta no mapa.
		err = errPlayerClosed
	}
	if err == nil {
		m.players[loc.ChannelID] = p
		pe.p = p
	}
	pe.err = err
	m.mu.Unlock()
	close(pe.ready)
	if err != nil {
		return nil, err
	}
	m.deps.BroadcastToRoom("server:"+loc.ServerID, event("music:presence", map[string]any{
		"server_id": loc.ServerID, "channel_id": loc.ChannelID, "active": true,
	}))
	return p, nil
}

// CloseServer fecha os players do servidor (Maestro removido pelo dono).
func (m *Manager) CloseServer(serverID string) {
	m.mu.Lock()
	var ps []*Player
	for _, p := range m.players {
		if p.ServerID == serverID {
			ps = append(ps, p)
		}
	}
	m.mu.Unlock()
	for _, p := range ps {
		go p.Close()
	}
}

func (m *Manager) Presence(serverID string) []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []string{}
	for _, p := range m.players {
		if p.ServerID == serverID {
			out = append(out, p.ChannelID)
		}
	}
	sort.Strings(out)
	return out
}

func (m *Manager) OnParticipantLeft(callID, userID string) {
	if p := m.playerByCall(callID); p != nil {
		go p.ParticipantLeft(userID)
	}
}

func (m *Manager) OnCallEnded(callID string) {
	if p := m.playerByCall(callID); p != nil {
		go p.Close()
	}
}
