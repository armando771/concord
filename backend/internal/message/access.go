package message

import (
	"context"
	"errors"

	"gin-quickstart/backend/internal/bot"
	"gin-quickstart/backend/internal/channel"
	"gin-quickstart/backend/internal/conversation"
	"gin-quickstart/backend/internal/friendship"
	"gin-quickstart/backend/internal/permission"
)

// Room é um canal de servidor ou uma DM (exatamente um dos dois preenchido).
type Room struct {
	ChannelID      string
	ConversationID string
}

var (
	ErrRoomNotFound  = errors.New("room not found")
	ErrNoRoomAccess  = errors.New("you do not have access to this room")
	ErrCannotMessage = errors.New("you can only message friends or people from your servers")
	ErrBlocked       = errors.New("you cannot message this user")
	// ErrBotConversation: DM com um bot (Salinha Bot) é só leitura.
	ErrBotConversation = errors.New("this conversation is read-only")
)

// PermissionChecker: as permissões do membro num canal (permission.Service).
type PermissionChecker interface {
	ChannelPerms(ctx context.Context, channelID, userID string) (int64, error)
}

// RoomAccess diz quem lê e quem escreve numa sala (mensagens e anexos).
type RoomAccess interface {
	CanRead(ctx context.Context, room Room, userID string) error
	CanWrite(ctx context.Context, room Room, userID string) error
}

// ServiceRoomAccess aplica as regras com as permissões do canal, DM e
// amizade: canal → lê quem tem VIEW_CHANNEL e envia anexo quem também tem
// SEND_MESSAGES e ATTACH_FILES; DM → participante lê e só escreve se for
// amigo ou dividir um servidor com o outro.
type ServiceRoomAccess struct {
	channels      *channel.Service
	perms         PermissionChecker
	conversations *conversation.Service
	friends       *friendship.Service
}

func NewServiceRoomAccess(channels *channel.Service, perms PermissionChecker, conversations *conversation.Service, friends *friendship.Service) *ServiceRoomAccess {
	return &ServiceRoomAccess{
		channels:      channels,
		perms:         perms,
		conversations: conversations,
		friends:       friends,
	}
}

func (a *ServiceRoomAccess) CanRead(ctx context.Context, room Room, userID string) error {
	if room.ChannelID != "" {
		return channelAccess(ctx, a.perms, room.ChannelID, userID, permission.ViewChannel)
	}
	_, err := a.conversationMember(ctx, room.ConversationID, userID)
	return err
}

func (a *ServiceRoomAccess) CanWrite(ctx context.Context, room Room, userID string) error {
	_, err := a.WriteParticipants(ctx, room, userID)
	return err
}

// WriteParticipants aplica a regra de CanWrite e, numa DM ou grupo, devolve os
// participantes lidos na mesma consulta (canal: nil). Usado pelo "digitando".
func (a *ServiceRoomAccess) WriteParticipants(ctx context.Context, room Room, userID string) ([]string, error) {
	if room.ChannelID != "" {
		return nil, channelAccess(ctx, a.perms, room.ChannelID, userID, permission.ViewChannel|permission.SendMessages|permission.AttachFiles)
	}
	conv, err := a.conversationMember(ctx, room.ConversationID, userID)
	if err != nil {
		return nil, err
	}
	if conv.IsGroup() {
		ids, err := a.conversations.ParticipantIDs(ctx, room.ConversationID)
		if err != nil {
			return nil, ErrNoRoomAccess
		}
		return ids, nil
	}

	otherUserID := conv.UserAID
	if otherUserID == userID {
		otherUserID = conv.UserBID
	}
	// DM com bot: ele avisa, ninguém responde.
	if bot.IsBot(otherUserID) {
		return nil, ErrBotConversation
	}
	// DM 1:1: sem bloqueio; amigos ou quem divide um servidor (se o outro
	// aceita DM de membros de servidores).
	if err := a.friends.CanDirectMessage(ctx, userID, otherUserID); err != nil {
		if errors.Is(err, friendship.ErrBlocked) {
			return nil, ErrBlocked
		}
		return nil, ErrCannotMessage
	}
	return []string{userID, otherUserID}, nil
}

// channelAccess: o membro tem want no canal. Canal que não existe ou que a
// pessoa não vê dá ErrRoomNotFound; falta de outra permissão, ErrNoRoomAccess.
func channelAccess(ctx context.Context, perms PermissionChecker, channelID string, userID string, want int64) error {
	got, err := perms.ChannelPerms(ctx, channelID, userID)
	switch {
	case errors.Is(err, permission.ErrChannelNotFound):
		return ErrRoomNotFound
	case err != nil:
		return ErrNoRoomAccess
	case got&permission.ViewChannel == 0:
		return ErrRoomNotFound
	case !permission.Has(got, want):
		return ErrNoRoomAccess
	}
	return nil
}

// conversationMember confere que userID participa da conversa.
func (a *ServiceRoomAccess) conversationMember(ctx context.Context, conversationID string, userID string) (*conversation.Conversation, error) {
	conv, err := a.conversations.FindByID(ctx, conversationID)
	if err != nil {
		return nil, ErrRoomNotFound
	}
	ok, err := a.conversations.IsParticipant(ctx, conversationID, userID)
	if err != nil || !ok {
		return nil, ErrNoRoomAccess
	}
	return conv, nil
}
