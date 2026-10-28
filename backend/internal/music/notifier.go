package music

// O Manager visto pelo Player: estado, avisos e quem está na call.
// Extraído do manager.go.

import (
	"context"
	"log"
	"time"
)

// notifier é o Manager visto pelo Player (Notifier).
type notifier Manager

func (n *notifier) PublishState(p *Player) {
	// Chamado com p.mu preso: monta o estado sem pegar o lock de novo.
	n.deps.BroadcastToCall(p.CallID, event("music:state", buildStateLocked(p, time.Now())))
}

func (n *notifier) Public(textChannelID, content string) {
	if textChannelID == "" {
		return
	}
	go func() {
		if err := n.deps.PostPublic(context.Background(), textChannelID, content); err != nil {
			log.Printf("[music] aviso público: %v", err)
		}
	}()
}

func (n *notifier) Humans(callID string) []string { return n.deps.Humans(callID) }

func (n *notifier) Closed(p *Player) {
	m := (*Manager)(n)
	m.mu.Lock()
	if m.players[p.ChannelID] == p {
		delete(m.players, p.ChannelID)
	}
	m.mu.Unlock()
	n.deps.BroadcastToCall(p.CallID, event("music:state", ClosedState(p)))
	n.deps.BroadcastToRoom("server:"+p.ServerID, event("music:presence", map[string]any{
		"server_id": p.ServerID, "channel_id": p.ChannelID, "active": false,
	}))
}
