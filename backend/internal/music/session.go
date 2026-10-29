package music

// Sessão do Maestro: o que ele precisa para voltar a um canal depois que o
// servidor reinicia (deploy). Gravada a cada mudança do player e, com a
// posição exata, no desligamento; apagada quando o player fecha de verdade.
// Ver docs/adr/0019-maestro-retoma-apos-reinicio.md.

import (
	"context"
	"time"
)

// Session é um player salvo: a faixa atual (só o ID do vídeo, que não
// expira; o áudio é baixado de novo) com a posição e a fila com quem pediu.
type Session struct {
	ChannelID string
	ServerID  string
	CallID    string
	// TextChannelID: canal do último pedido (aviso de queda do player).
	TextChannelID string
	Now           *Item // nil = entre uma faixa e outra
	Position      time.Duration
	Queue         []*Item
	SavedAt       time.Time
}

// SessionStore guarda as sessões (session_repository.go no Postgres).
type SessionStore interface {
	Save(ctx context.Context, s Session) error
	Delete(ctx context.Context, channelID string) error
	List(ctx context.Context) ([]Session, error)
}

// items: a fila para retomar, com a atual na frente começando da posição.
func (s Session) items() []*Item {
	var out []*Item
	if s.Now != nil {
		now := *s.Now
		now.ResumeAt = s.Position
		out = append(out, &now)
	}
	for _, it := range s.Queue {
		cp := *it
		out = append(out, &cp)
	}
	return out
}

// sessionLocked: onde o player está agora; nil = nada tocando nem na fila.
func (p *Player) sessionLocked() *Session {
	if p.now == nil && p.queue.Len() == 0 {
		return nil
	}
	now := p.deps.Now()
	s := &Session{
		ChannelID: p.ChannelID, ServerID: p.ServerID, CallID: p.CallID,
		TextChannelID: p.lastText, SavedAt: now,
	}
	if p.now != nil {
		s.Now = savedCopy(p.now)
		s.Position = max(now.Sub(p.nowStarted), 0)
	}
	for _, it := range p.queue.Items() {
		s.Queue = append(s.Queue, savedCopy(it))
	}
	return s
}

// savedCopy: o pedido sem os arquivos do cache (que não sobrevivem ao reinício).
func savedCopy(it *Item) *Item {
	return &Item{ID: it.ID, Track: it.Track, RequestedBy: it.RequestedBy, TextChannelID: it.TextChannelID}
}

// Freeze congela o player no desligamento do servidor e devolve onde ele
// estava (nil = nada a retomar). Dali em diante ele ignora tudo: os ffmpeg e
// yt-dlp morrem junto com o SIGTERM e não podem pular a faixa, tirar alguém
// da fila nem avisar queda no chat. O Manager não fica sabendo do fechamento,
// então a sessão fica no banco para a retomada.
func (p *Player) Freeze() *Session {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.closed {
		return nil
	}
	s := p.sessionLocked()
	p.closed = true
	p.stopIdleLocked()
	return s
}
