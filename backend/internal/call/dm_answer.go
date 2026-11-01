package call

import (
	"context"
	"log"
	"time"
)

// Atender e recusar a chamada de DM que está tocando. Extraído do service.go.

func (s *Service) Accept(ctx context.Context, callID string, userID string) error {
	s.mu.Lock()
	ac, ok := s.calls[callID]
	if !ok || ac.info.Status == StatusEnded {
		s.mu.Unlock()
		return ErrNotFound
	}
	if ac.info.Type == TypeDM && ac.inviteeID != userID {
		s.mu.Unlock()
		return ErrNotAllowed
	}
	if _, ok := ac.participants[userID]; ok {
		s.mu.Unlock()
		return nil
	}
	if otherID, ok := s.busy[userID]; ok && otherID != callID {
		s.mu.Unlock()
		return ErrBusy
	}

	userInfo, err := s.lookupUser(ctx, userID)
	if err != nil {
		s.mu.Unlock()
		return err
	}

	now := time.Now()
	ac.participants[userID] = &participantState{
		userID:   userID,
		role:     RoleMember,
		joinedAt: now,
	}
	wasRinging := ac.info.Status != StatusActive
	ac.info.Status = StatusActive
	s.busy[userID] = callID
	callIDCopy := ac.info.ID
	s.mu.Unlock()

	// Primeiro quem entrou, depois o status: se o backend cair entre os dois,
	// a DM fica "ringing" com os dois dentro e a subida a cura (restore). Na
	// ordem inversa ficaria "active" só com quem ligou.
	if err := s.addParticipant(ctx, &CallParticipant{
		CallID: callID,
		UserID: userID,
		Role:   RoleMember,
	}); err != nil {
		log.Printf("[call] persist participant %s failed: %v", userID, err)
	}

	if wasRinging {
		s.markCallActive(callID)
	}

	s.publisher.BroadcastToCall(callIDCopy, marshalEvent("call:accept", ResponseEvent{
		CallID: callIDCopy,
		User:   userInfo,
	}))

	return nil
}

func (s *Service) Decline(ctx context.Context, callID string, userID string) error {
	s.mu.Lock()
	ac, ok := s.calls[callID]
	if !ok || ac.info.Status == StatusEnded {
		s.mu.Unlock()
		return ErrNotFound
	}
	if ac.info.Type == TypeDM && ac.inviteeID != userID {
		s.mu.Unlock()
		return ErrNotAllowed
	}

	userInfo, err := s.lookupUser(ctx, userID)
	if err != nil {
		s.mu.Unlock()
		return err
	}
	initiatorID := ac.info.InitiatorID
	s.mu.Unlock()

	s.publisher.SendToUser(initiatorID, marshalEvent("call:decline", ResponseEvent{
		CallID: callID,
		User:   userInfo,
	}))

	return s.End(ctx, callID)
}
