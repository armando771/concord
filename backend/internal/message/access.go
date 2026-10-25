package message

import (
	"context"
	"errors"

	"gin-quickstart/backend/internal/channel"
	"gin-quickstart/backend/internal/conversation"
	"gin-quickstart/backend/internal/friendship"
	"gin-quickstart/backend/internal/server"
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
)

// RoomAccess diz quem lê e quem escreve numa sala (mensagens e anexos).
type RoomAccess interface {
	CanRead(ctx context.Context, room Room, userID string) error
	CanWrite(ctx context.Context, room Room, userID string) error
}

// ServiceRoomAccess aplica as regras com os serviços de canal, servidor, DM e
// amizade: canal → membro do servidor lê e escreve; DM → participante lê e só
// escreve se for amigo ou dividir um servidor com o outro.
type ServiceRoomAccess struct {
	channels      *channel.Service
	servers       *server.Service
	conversations *conversation.Service
	friends       *friendship.Service
}

func NewServiceRoomAccess(channels *channel.Service, servers *server.Service, conversations *conversation.Service, friends *friendship.Service) *ServiceRoomAccess {
	return &ServiceRoomAccess{
		channels:      channels,
		servers:       servers,
		conversations: conversations,
		friends:       friends,
	}
}

func (a *ServiceRoomAccess) CanRead(ctx context.Context, room Room, userID string) error {
	if room.ChannelID != "" {
		return a.channelMember(ctx, room.ChannelID, userID)
	}
	_, err := a.conversationMember(ctx, room.ConversationID, userID)
	return err
}

func (a *ServiceRoomAccess) CanWrite(ctx context.Context, room Room, userID string) error {
	if room.ChannelID != "" {
		return a.channelMember(ctx, room.ChannelID, userID)
	}
	conv, err := a.conversationMember(ctx, room.ConversationID, userID)
	if err != nil {
		return err
	}
	if conv.IsGroup() {
		return nil
	}

	otherUserID := conv.UserAID
	if otherUserID == userID {
		otherUserID = conv.UserBID
	}
	// DM 1:1: sem bloqueio; amigos ou quem divide um servidor (se o outro
	// aceita DM de membros de servidores).
	if err := a.friends.CanDirectMessage(ctx, userID, otherUserID); err != nil {
		if errors.Is(err, friendship.ErrBlocked) {
			return ErrBlocked
		}
		return ErrCannotMessage
	}
	return nil
}

func (a *ServiceRoomAccess) channelMember(ctx context.Context, channelID string, userID string) error {
	ch, err := a.channels.FindByID(ctx, channelID)
	if err != nil {
		return ErrRoomNotFound
	}
	isMember, err := a.servers.IsMember(ctx, ch.ServerID, userID)
	if err != nil || !isMember {
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
