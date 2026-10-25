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
	// typingMinInterval: o app manda no máximo um "digitando" a cada 3 s; o
	// que passar de 1 por segundo é descartado.
	typingMinInterval = time.Second
	typingLookupWait  = 3 * time.Second
	// Acima disso o limitador limpa quem já saiu da janela.
	typingLimiterSweepAt = 1024
)

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

	mu   sync.Mutex
	last map[string]time.Time // "<user>|<tipo>" → último aceito
}

func NewTyping(hub *Hub, access message.RoomAccess, participants message.ConversationResolver, users UserLookup) *Typing {
	return &Typing{
		hub:          hub,
		access:       access,
		participants: participants,
		users:        users,
		now:          time.Now,
		last:         make(map[string]time.Time),
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
	if !t.allow(userID + "|" + evType) {
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

func (t *Typing) allow(key string) bool {
	now := t.now()
	t.mu.Lock()
	defer t.mu.Unlock()
	if last, ok := t.last[key]; ok && now.Sub(last) < typingMinInterval {
		return false
	}
	if len(t.last) >= typingLimiterSweepAt {
		for k, at := range t.last {
			if now.Sub(at) >= typingMinInterval {
				delete(t.last, k)
			}
		}
	}
	t.last[key] = now
	return true
}
