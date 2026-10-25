package websocket

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"gin-quickstart/backend/internal/message"
	"gin-quickstart/backend/internal/user"
)

const (
	// O app manda no máximo um "digitando" a cada 3 s (mais o stop). Por
	// pessoa vale cerca de 1 evento por segundo, com uma folga de 3 para a
	// sequência typing → stop → typing de quem envia e já volta a digitar.
	typingRefill     = time.Second
	typingBurst      = 3
	typingLookupWait = 3 * time.Second
	// Acima disso o limitador esquece quem já está com a folga cheia.
	typingLimiterSweepAt = 1024
)

// typingBucket: fichas de quem digita (typing e stop gastam uma cada).
type typingBucket struct {
	tokens float64
	at     time.Time
}

// UserLookup busca o nome de quem está digitando (user.Service.FindByID).
type UserLookup func(ctx context.Context, userID string) (*user.User, error)

// Typing repassa o "fulano está digitando…" de um canal ou DM para quem vê a
// sala, menos quem digita. Nada é salvo.
type Typing struct {
	hub          *Hub
	access       message.RoomAccess
	participants message.ConversationResolver
	users        UserLookup
	now          func() time.Time

	mu      sync.Mutex
	buckets map[string]*typingBucket
}

func NewTyping(hub *Hub, access message.RoomAccess, participants message.ConversationResolver, users UserLookup) *Typing {
	return &Typing{
		hub:          hub,
		access:       access,
		participants: participants,
		users:        users,
		now:          time.Now,
		buckets:      make(map[string]*typingBucket),
	}
}

// Handle trata "typing" e "typing:stop" vindos do app ({room}).
func (t *Typing) Handle(ctx context.Context, userID string, evType string, payload json.RawMessage) {
	if evType != "typing" && evType != "typing:stop" {
		return
	}
	var p struct {
		Room string `json:"room"`
	}
	if err := json.Unmarshal(payload, &p); err != nil {
		return
	}
	channelID, conversationID, _, _, _ := parseRoom(p.Room)
	if channelID == "" && conversationID == "" {
		return
	}
	// O limite vem antes do acesso: evento descartado não consulta o banco.
	if !t.allow(userID) {
		return
	}

	ctx, cancel := context.WithTimeout(ctx, typingLookupWait)
	defer cancel()

	// Digitar é o começo de mandar mensagem: mesma regra de quem pode escrever.
	if err := t.access.CanWrite(ctx, message.Room{ChannelID: channelID, ConversationID: conversationID}, userID); err != nil {
		return
	}

	out := map[string]interface{}{
		"room":    p.Room,
		"user_id": userID,
	}
	if evType == "typing" {
		u, err := t.users(ctx, userID)
		if err != nil || u == nil {
			return
		}
		name := u.DisplayName
		if name == "" {
			name = u.Username
		}
		out["display_name"] = name
		out["username"] = u.Username
	}

	t.hub.BroadcastToRoomsExcept(t.rooms(ctx, channelID, conversationID), userID, writeEvent(evType, out))
}

// rooms segue o caminho do message:create, menos a sala do servidor: lá
// estão todos com o servidor aberto, em qualquer canal, e o digitando só
// aparece no canal aberto. Na DM vai também para a sala pessoal de cada
// participante (dica na lista de conversas).
func (t *Typing) rooms(ctx context.Context, channelID string, conversationID string) []string {
	if channelID != "" {
		return messageRooms(&channelID, "", nil, nil)
	}
	var userIDs []string
	if t.participants != nil {
		userIDs, _ = t.participants.ConversationParticipantIDs(ctx, conversationID)
	}
	return messageRooms(nil, "", &conversationID, userIDs)
}

func (t *Typing) allow(userID string) bool {
	now := t.now()
	t.mu.Lock()
	defer t.mu.Unlock()
	if len(t.buckets) >= typingLimiterSweepAt {
		for id, b := range t.buckets {
			if b.fill(now) >= typingBurst {
				delete(t.buckets, id)
			}
		}
	}
	b, ok := t.buckets[userID]
	if !ok {
		b = &typingBucket{tokens: typingBurst, at: now}
		t.buckets[userID] = b
	}
	b.tokens, b.at = b.fill(now), now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// fill: fichas de agora (uma a cada typingRefill, até typingBurst).
func (b *typingBucket) fill(now time.Time) float64 {
	tokens := b.tokens + float64(now.Sub(b.at))/float64(typingRefill)
	if tokens > typingBurst {
		return typingBurst
	}
	return tokens
}
