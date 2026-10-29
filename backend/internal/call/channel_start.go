package call

import (
	"context"
	"log"
	"time"

	"gin-quickstart/backend/internal/channel"

	"github.com/google/uuid"
)

// Entrar na chamada de um canal de voz (ou abri-la). Extraído do service.go.

func (s *Service) StartChannel(ctx context.Context, initiatorID string, channelID string) (*Call, error) {
	return s.startChannel(ctx, initiatorID, channelID, false)
}

// startChannel entra (ou cria) a chamada do canal. bypassLock deixa passar
// por sala trancada (moderador movendo alguém).
func (s *Service) startChannel(ctx context.Context, initiatorID string, channelID string, bypassLock bool) (*Call, error) {
	ch, err := s.findChannel(ctx, channelID)
	if err != nil {
		return nil, ErrNotFound
	}

	if err := s.requireConnect(ctx, ch.ID, initiatorID); err != nil {
		return nil, err
	}

	s.mu.Lock()
	if call, busy, err := s.alreadyInCallLocked(initiatorID, channelID); busy {
		s.mu.Unlock()
		return call, err
	}
	if existing := s.findActiveByScopeLocked(TypeChannel, channelID); existing != nil {
		return s.enterExistingLocked(ctx, existing, initiatorID, bypassLock)
	}
	return s.openChannelCallLocked(ctx, ch, initiatorID)
}

// alreadyInCallLocked: quem já está numa chamada não abre outra. Na deste
// canal, devolve ela mesma; em outra, ErrBusy. busy = false se está livre.
func (s *Service) alreadyInCallLocked(userID, channelID string) (call *Call, busy bool, err error) {
	callID, ok := s.busy[userID]
	if !ok {
		return nil, false, nil
	}
	existing := s.calls[callID]
	if existing != nil && existing.info.ChannelID != nil && *existing.info.ChannelID == channelID {
		return existing.info, true, nil
	}
	return nil, true, ErrBusy
}

// enterExistingLocked entra na chamada que já acontece no canal (sala
// trancada só com bypassLock ou entrada liberada). Solta o lock.
func (s *Service) enterExistingLocked(ctx context.Context, ac *activeCall, userID string, bypassLock bool) (*Call, error) {
	if !bypassLock && !canEnterLockedLocked(ac, userID, time.Now()) {
		s.mu.Unlock()
		return ac.info, ErrLocked
	}
	s.mu.Unlock()
	return s.joinLocked(ctx, ac, userID, RoleMember)
}

// openChannelCallLocked abre a chamada do canal com quem chegou primeiro.
// Solta o lock.
func (s *Service) openChannelCallLocked(ctx context.Context, ch *channel.Channel, initiatorID string) (*Call, error) {
	call := &Call{
		ID:          uuid.New().String(),
		Type:        TypeChannel,
		ChannelID:   &ch.ID,
		ServerID:    &ch.ServerID,
		InitiatorID: initiatorID,
		Status:      StatusActive,
	}
	ac := &activeCall{
		info:         call,
		participants: make(map[string]*participantState),
	}
	s.calls[call.ID] = ac
	s.mu.Unlock()

	if err := s.repository.Create(ctx, call); err != nil {
		log.Printf("[call] persist call %s failed: %v", call.ID, err)
	}

	if _, err := s.joinLocked(ctx, ac, initiatorID, RoleMember); err != nil {
		return nil, err
	}
	return call, nil
}
