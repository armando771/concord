package music

// Reinício do servidor (deploy): no desligamento cada player é congelado e
// gravado com a posição exata; no boot, depois de as calls serem
// recarregadas, o Maestro volta aos canais em que ainda há gente e continua
// a faixa de onde parou. Ver docs/adr/0019-maestro-retoma-apos-reinicio.md.

import (
	"context"
	"errors"
	"log"
	"os"
	"path/filepath"
	"time"
)

const (
	// sessionMaxAge: sessão mais velha que isso é de uma queda longa, não de
	// um deploy; ninguém espera a música voltar.
	sessionMaxAge = 2 * time.Hour
	// resumeDelay: dá tempo de os apps reconectarem (WebSocket 1012) antes de
	// o Maestro entrar, para eles verem a presença e o painel.
	resumeDelay = 3 * time.Second
	// resumeTimeout: teto da retomada inteira (ler o banco e entrar nas salas).
	resumeTimeout = time.Minute
)

// RunSessions retoma as sessões salvas (em segundo plano, sem segurar o boot)
// e, quando ctx acaba (SIGTERM), grava onde cada player estava. Só volta
// depois de gravar: o desligamento espera por ele antes de fechar o banco.
func (m *Manager) RunSessions(ctx context.Context) {
	if m.sessions == nil {
		return
	}
	resume := time.AfterFunc(resumeDelay, func() { m.Resume(ctx) })
	<-ctx.Done()
	resume.Stop()
	m.Shutdown()
}

// Resume põe o Maestro de volta nos canais salvos. Idempotente: canal que já
// tem player fica como está.
func (m *Manager) Resume(ctx context.Context) {
	if m.sessions == nil {
		return
	}
	ctx, cancel := context.WithTimeout(ctx, resumeTimeout)
	defer cancel()
	list, err := m.deps.Sessions.List(ctx)
	if err != nil {
		log.Printf("[music] ler sessões para retomar: %v", err)
		return
	}
	for _, s := range list {
		if m.stopping.Load() {
			return // o desligamento começou no meio da retomada
		}
		m.resumeOne(ctx, s)
	}
}

func (m *Manager) resumeOne(ctx context.Context, s Session) {
	if why := m.discardReason(ctx, s); why != "" {
		log.Printf("[music] sessão do canal %s descartada: %s", s.ChannelID, why)
		m.sessions.put(s.ChannelID, nil)
		_ = os.RemoveAll(filepath.Join(m.cfg.CacheDir, s.ChannelID))
		return
	}
	loc := Location{CallID: s.CallID, ChannelID: s.ChannelID, ServerID: s.ServerID}
	p, err := m.newPlayerFor(ctx, loc)
	if errors.Is(err, errChannelBusy) {
		return // já voltou (ou alguém pediu música): esse player grava por cima
	}
	if err != nil {
		log.Printf("[music] retomar canal %s: %v", s.ChannelID, err)
		return
	}
	if _, err := p.Enqueue(s.items(), s.TextChannelID); err != nil {
		log.Printf("[music] retomar fila do canal %s: %v", s.ChannelID, err)
		p.IdleIfEmpty()
		return
	}
	log.Printf("[music] Maestro de volta no canal %s (%d faixas, da posição %s)", s.ChannelID, len(s.items()), s.Position.Round(time.Second))
}

// discardReason: por que a sessão não volta ("" = volta).
func (m *Manager) discardReason(ctx context.Context, s Session) string {
	switch {
	case s.Now == nil && len(s.Queue) == 0:
		return "nada para tocar"
	case time.Since(s.SavedAt) > sessionMaxAge:
		return "sessão velha"
	case !m.available:
		return "Maestro indisponível"
	case len(m.deps.Humans(s.CallID)) == 0:
		return "call encerrada ou vazia"
	case !m.deps.BotEnabled(ctx, s.ServerID):
		return "Maestro removido do servidor"
	}
	return ""
}

// Shutdown congela os players e grava onde cada um estava, esperando o banco.
// Daí em diante nada que os players façam muda as sessões nem vira aviso.
func (m *Manager) Shutdown() {
	if m.sessions == nil {
		return
	}
	m.stopping.Store(true)
	m.sessions.freeze()
	m.mu.Lock()
	players := make([]*Player, 0, len(m.players))
	for _, p := range m.players {
		players = append(players, p)
	}
	m.mu.Unlock()
	var final []Session
	for _, p := range players {
		if s := p.Freeze(); s != nil {
			final = append(final, *s)
		}
	}
	m.sessions.flush(final)
	log.Printf("[music] desligamento: %d sessões do Maestro gravadas", len(final))
	for _, p := range players {
		p.leave()
	}
}
