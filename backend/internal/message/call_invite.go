package message

import (
	"context"
	"encoding/json"
	"log"

	"github.com/google/uuid"
)

// CallInviteContent é o texto da mensagem de convite: o que aparece em
// notificações, na prévia da lista de DMs e na busca. O app mostra o cartão
// (CallInvite) no lugar dele.
const CallInviteContent = "Convidou você para a call"

// CallInvite: o convite para a call de um canal de voz, guardado na mensagem
// (messages.call_invite). Os nomes são a foto do momento do convite; a
// validade do cartão vem do estado da call, não daqui.
type CallInvite struct {
	CallID      string  `json:"call_id"`
	ChannelID   string  `json:"channel_id"`
	ServerID    *string `json:"server_id,omitempty"`
	ChannelName string  `json:"channel_name,omitempty"`
	ServerName  string  `json:"server_name,omitempty"`
}

// callInviteBytes é o JSON da coluna (nil = coluna nula).
func callInviteBytes(ci *CallInvite) []byte {
	if ci == nil {
		return nil
	}
	b, err := json.Marshal(ci)
	if err != nil {
		return nil
	}
	return b
}

// parseCallInvite lê a coluna; vazio ou ilegível = mensagem sem convite.
func parseCallInvite(raw []byte) *CallInvite {
	if len(raw) == 0 {
		return nil
	}
	var ci CallInvite
	if err := json.Unmarshal(raw, &ci); err != nil || ci.CallID == "" {
		return nil
	}
	return &ci
}

// newCallInviteMessage monta a mensagem do convidador na DM.
func newCallInviteMessage(conversationID, authorID string, invite CallInvite) *Message {
	return &Message{
		ID:             uuid.New().String(),
		AuthorID:       authorID,
		ConversationID: &conversationID,
		Content:        CallInviteContent,
		CallInvite:     &invite,
	}
}

// inviteStore: o que o convite usa do Repository (trocável nos testes).
type inviteStore interface {
	Create(ctx context.Context, msg *Message) error
	FindByID(ctx context.Context, id string) (*Message, error)
}

// CreateCallInviteMessage posta, na DM, o cartão de convite do convidador.
// Quem chama já validou amizade e bloqueio; a DM reabre para quem a fechou.
func (s *Service) CreateCallInviteMessage(ctx context.Context, conversationID, authorID string, invite CallInvite) (*Message, error) {
	return postToConversation(ctx, s.repository, s.convResolver, s.publisher, newCallInviteMessage(conversationID, authorID, invite))
}

// postToConversation grava a mensagem já montada numa DM, reabre a DM para
// quem a fechou e avisa os participantes.
func postToConversation(ctx context.Context, store inviteStore, convs ConversationResolver, pub EventPublisher, msg *Message) (*Message, error) {
	if err := store.Create(ctx, msg); err != nil {
		return nil, err
	}
	full, err := store.FindByID(ctx, msg.ID)
	if err != nil {
		return nil, err
	}
	var userIDs []string
	if convs != nil {
		if err := convs.RevealConversation(ctx, *msg.ConversationID); err != nil {
			log.Printf("[message] reveal conversation %s: %v", *msg.ConversationID, err)
		}
		userIDs, _ = convs.ConversationParticipantIDs(ctx, *msg.ConversationID)
	}
	pub.PublishMessageCreate(CreateEvent{ConversationID: full.ConversationID, UserIDs: userIDs, Message: *full})
	return full, nil
}
