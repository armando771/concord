package call

import (
	"context"
	"errors"
	"log"

	"gin-quickstart/backend/internal/channel"
)

var (
	ErrNotModerator    = errors.New("só moderadores podem mover pessoas entre canais de voz")
	ErrNotInVoice      = errors.New("essa pessoa não está em um canal de voz deste servidor")
	ErrSameChannel     = errors.New("essa pessoa já está nesse canal")
	ErrNotVoiceChannel = errors.New("o destino precisa ser um canal de voz")
	ErrCannotMoveOwner = errors.New("só o dono pode mover o dono do servidor")
)

// MovedEvent avisa quem foi movido (o cliente dele troca de sala sozinho) e
// o servidor (listas dos canais de voz).
type MovedEvent struct {
	CallID        string   `json:"call_id"`
	FromCallID    string   `json:"from_call_id"`
	FromChannelID string   `json:"from_channel_id"`
	ChannelID     string   `json:"channel_id"`
	ChannelName   string   `json:"channel_name"`
	ServerID      string   `json:"server_id"`
	User          UserInfo `json:"user"`
	MovedBy       UserInfo `json:"moved_by"`
}

// voiceLocation é onde alguém está conectado num canal de voz.
type voiceLocation struct {
	callID    string
	channelID string
	serverID  string
}

// voiceLocationOf diz em qual canal de voz o usuário está (ok=false se não
// estiver em nenhum, ou se estiver numa DM).
func (s *Service) voiceLocationOf(userID string) (voiceLocation, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	callID, ok := s.busy[userID]
	if !ok {
		return voiceLocation{}, false
	}
	ac, ok := s.calls[callID]
	if !ok || ac.info.Type != TypeChannel || ac.info.ChannelID == nil || ac.info.ServerID == nil {
		return voiceLocation{}, false
	}
	if _, in := ac.participants[userID]; !in {
		return voiceLocation{}, false
	}
	return voiceLocation{callID: callID, channelID: *ac.info.ChannelID, serverID: *ac.info.ServerID}, true
}

// checkMove aplica as regras de quem pode mover quem, e para onde.
func checkMove(actorIsModerator bool, actorID, ownerID, targetID string, from voiceLocation, inVoice bool, dest *channel.Channel) error {
	if dest.Type != channel.TypeVoice {
		return ErrNotVoiceChannel
	}
	if !inVoice || from.serverID != dest.ServerID {
		return ErrNotInVoice
	}
	if !actorIsModerator {
		return ErrNotModerator
	}
	if targetID == ownerID && actorID != ownerID {
		return ErrCannotMoveOwner
	}
	if from.channelID == dest.ID {
		return ErrSameChannel
	}
	return nil
}

// MoveToChannel tira targetID do canal de voz em que está e o coloca em
// channelID. Só o dono e os moderadores do servidor podem fazer isso.
func (s *Service) MoveToChannel(ctx context.Context, actorID, targetID, channelID string) (*Call, error) {
	dest, err := s.channelService.FindByID(ctx, channelID)
	if err != nil {
		return nil, ErrNotFound
	}

	from, inVoice := s.voiceLocationOf(targetID)

	isModerator, err := s.channelService.IsAdminOrOwner(ctx, dest.ServerID, actorID)
	if err != nil {
		return nil, err
	}
	srv, err := s.serverService.FindByID(ctx, dest.ServerID)
	if err != nil {
		return nil, ErrNotFound
	}

	if err := checkMove(isModerator, actorID, srv.OwnerID, targetID, from, inVoice, dest); err != nil {
		return nil, err
	}

	if err := s.Leave(ctx, from.callID, targetID); err != nil {
		return nil, err
	}
	call, err := s.StartChannel(ctx, targetID, dest.ID)
	if err != nil {
		log.Printf("[call] move %s to %s failed after leaving: %v", targetID, dest.ID, err)
		return nil, err
	}

	targetInfo, err := s.userInfo(ctx, targetID)
	if err != nil {
		return call, nil
	}
	actorInfo, _ := s.userInfo(ctx, actorID)
	event := marshalEvent("call:moved", MovedEvent{
		CallID:        call.ID,
		FromCallID:    from.callID,
		FromChannelID: from.channelID,
		ChannelID:     dest.ID,
		ChannelName:   dest.Name,
		ServerID:      dest.ServerID,
		User:          targetInfo,
		MovedBy:       actorInfo,
	})
	s.publisher.SendToUser(targetID, event)
	s.publisher.BroadcastToRoom("server:"+dest.ServerID, event)

	return call, nil
}
