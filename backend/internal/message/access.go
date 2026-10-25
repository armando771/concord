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
	_, err := a.conversationOther(ctx, room.ConversationID, userID)
	return err
}

func (a *ServiceRoomAccess) CanWrite(ctx context.Context, room Room, userID string) error {
	_, err := a.WriteParticipants(ctx, room, userID)
	return err
}

// WriteParticipants aplica a regra de CanWrite e, numa DM, devolve os dois
// participantes lidos na mesma consulta (canal: nil). Usado pelo "digitando".
func (a *ServiceRoomAccess) WriteParticipants(ctx context.Context, room Room, userID string) ([]string, error) {
	if room.ChannelID != "" {
		return nil, a.channelMember(ctx, room.ChannelID, userID)
	}
	otherUserID, err := a.conversationOther(ctx, room.ConversationID, userID)
	if err != nil {
		return nil, err
	}

	// DM liberada entre amigos ou entre quem divide um servidor.
	areFriends, _ := a.friends.AreFriends(ctx, userID, otherUserID)
	if !areFriends {
		shares, err := a.servers.SharesServer(ctx, userID, otherUserID)
		if err != nil || !shares {
			return nil, ErrCannotMessage
		}
	}
	return []string{userID, otherUserID}, nil
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

// conversationOther confere que userID participa da DM e devolve o outro.
func (a *ServiceRoomAccess) conversationOther(ctx context.Context, conversationID string, userID string) (string, error) {
	conv, err := a.conversations.FindByID(ctx, conversationID)
	if err != nil {
		return "", ErrRoomNotFound
	}
	switch userID {
	case conv.UserAID:
		return conv.UserBID, nil
	case conv.UserBID:
		return conv.UserAID, nil
	}
	return "", ErrNoRoomAccess
}
