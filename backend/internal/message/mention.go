package message

import (
	"context"
	"log"
	"strings"
	"sync"
	"time"
)

// Menções em massa num canal de servidor: @all avisa todo mundo do canal,
// @here só quem está online. Só dono e moderadores pingam; de qualquer outro
// (ou numa DM) o texto fica como está e ninguém é avisado.
const (
	MentionAll  = "all"
	MentionHere = "here"
)

// Janela do anti-spam: um @all/@here que pinga por autor, por canal.
const mentionEveryoneCooldown = 30 * time.Second

// ModeratorChecker diz se a pessoa é dona ou moderadora do servidor (a mesma
// regra de quem gerencia canais).
type ModeratorChecker interface {
	IsAdminOrOwner(ctx context.Context, serverID string, userID string) (bool, error)
}

func isNickByte(b byte) bool {
	return b == '_' || (b >= '0' && b <= '9') || (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z')
}

// DetectEveryoneMention acha @all/@here como palavra inteira (sem diferenciar
// maiúsculas): não vale dentro de palavra, e-mail ("x@all.com") nem nick
// maior ("@allan", "@all.bot"). Se as duas aparecem, @all ganha. Mesma regra
// de token do @nick do app (lib/mentions.ts). O app não renderiza código
// inline, então crase não muda nada.
func DetectEveryoneMention(content string) string {
	lower := strings.ToLower(content)
	found := ""
	for i := 0; i < len(lower); i++ {
		if lower[i] != '@' {
			continue
		}
		if i > 0 {
			prev := lower[i-1]
			if isNickByte(prev) || prev == '.' || prev == '@' {
				continue
			}
		}
		for _, word := range []string{MentionAll, MentionHere} {
			end := i + 1 + len(word)
			if !strings.HasPrefix(lower[i+1:], word) || !tokenEndsAt(lower, end) {
				continue
			}
			if word == MentionAll {
				return MentionAll
			}
			found = MentionHere
		}
	}
	return found
}

// tokenEndsAt: o nick acaba em end? Ponto final conta como pontuação ("@all."),
// mas ponto seguido de letra continua o nick ("@all.bot").
func tokenEndsAt(s string, end int) bool {
	if end >= len(s) {
		return true
	}
	if isNickByte(s[end]) {
		return false
	}
	if s[end] == '.' {
		j := end
		for j < len(s) && s[j] == '.' {
			j++
		}
		return j >= len(s) || !isNickByte(s[j])
	}
	return true
}

// mentionLimiter guarda, em memória, o último @all/@here que pingou por autor
// e canal. Uma instância do backend só; reiniciar zera as janelas.
type mentionLimiter struct {
	mu     sync.Mutex
	window time.Duration
	now    func() time.Time
	last   map[string]time.Time
}

func newMentionLimiter(window time.Duration, now func() time.Time) *mentionLimiter {
	return &mentionLimiter{window: window, now: now, last: make(map[string]time.Time)}
}

// Allow diz se este autor pode pingar o canal agora e, se pode, marca a vez.
func (l *mentionLimiter) Allow(authorID string, channelID string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	key := authorID + "|" + channelID
	if last, ok := l.last[key]; ok && now.Sub(last) < l.window {
		return false
	}
	l.last[key] = now

	// Não deixa o mapa crescer para sempre: limpa as janelas vencidas.
	if len(l.last) > 1024 {
		for k, t := range l.last {
			if now.Sub(t) >= l.window {
				delete(l.last, k)
			}
		}
	}
	return true
}

// Release devolve a vez marcada por Allow (a mensagem não chegou a sair).
func (l *mentionLimiter) Release(authorID string, channelID string) {
	l.mu.Lock()
	delete(l.last, authorID+"|"+channelID)
	l.mu.Unlock()
}

// resolveMentionEveryone decide o mention_everyone de uma mensagem nova num
// canal: "all"/"here" se o texto marca e o autor pode (dono ou moderador,
// dentro do anti-spam); senão nil — a mensagem sai igual, só não pinga.
func (s *Service) resolveMentionEveryone(ctx context.Context, serverID string, channelID string, authorID string, content string) *string {
	kind := DetectEveryoneMention(content)
	if kind == "" || serverID == "" || channelID == "" || s.moderators == nil {
		return nil
	}
	allowed, err := s.moderators.IsAdminOrOwner(ctx, serverID, authorID)
	if err != nil {
		log.Printf("mention_everyone: failed to check role of %s in %s: %v", authorID, serverID, err)
		return nil
	}
	if !allowed || !s.mentionLimiter.Allow(authorID, channelID) {
		return nil
	}
	return &kind
}
