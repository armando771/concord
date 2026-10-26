package call

import (
	"context"
	"errors"
	"time"
)

var (
	ErrCallNotFound = errors.New("call_not_found")
)

// HandleScreenDraw processa um novo traço desenhado sobre a transmissão de sharerID
// e faz o broadcast para todos os participantes da chamada.
func (s *Service) HandleScreenDraw(ctx context.Context, userID string, p ScreenDrawPayload) error {
	s.mu.RLock()
	ac, ok := s.calls[p.CallID]
	if !ok {
		s.mu.RUnlock()
		return ErrCallNotFound
	}
	if _, ok := ac.participants[userID]; !ok {
		s.mu.RUnlock()
		return ErrNotAllowed
	}
	s.mu.RUnlock()

	stroke := p.Stroke
	stroke.SharerID = p.SharerID
	stroke.UserID = userID
	if stroke.CreatedAt == 0 {
		stroke.CreatedAt = time.Now().UnixMilli()
	}

	s.publisher.BroadcastToCall(p.CallID, marshalEvent("call:screen_draw", ScreenDrawPayload{
		CallID:   p.CallID,
		SharerID: p.SharerID,
		Stroke:   stroke,
	}))
	return nil
}

// HandleScreenDrawClear limpa todas as anotações sobre a transmissão de sharerID.
func (s *Service) HandleScreenDrawClear(ctx context.Context, userID string, p ScreenDrawClearPayload) error {
	s.mu.RLock()
	ac, ok := s.calls[p.CallID]
	if !ok {
		s.mu.RUnlock()
		return ErrCallNotFound
	}
	if _, ok := ac.participants[userID]; !ok {
		s.mu.RUnlock()
		return ErrNotAllowed
	}
	s.mu.RUnlock()

	s.publisher.BroadcastToCall(p.CallID, marshalEvent("call:screen_draw_clear", p))
	return nil
}

// HandleScreenDrawUndo desfaz um traço específico sobre a transmissão de sharerID.
func (s *Service) HandleScreenDrawUndo(ctx context.Context, userID string, p ScreenDrawUndoPayload) error {
	s.mu.RLock()
	ac, ok := s.calls[p.CallID]
	if !ok {
		s.mu.RUnlock()
		return ErrCallNotFound
	}
	if _, ok := ac.participants[userID]; !ok {
		s.mu.RUnlock()
		return ErrNotAllowed
	}
	s.mu.RUnlock()

	s.publisher.BroadcastToCall(p.CallID, marshalEvent("call:screen_draw_undo", p))
	return nil
}
