package call

import (
	"context"
	"time"
)

// Toque da chamada de DM: quem pode receber, limite de tempo e aviso para quem observa de fora (push).
// Extraído do service.go (god service): nada de método novo lá.

// RingTimeout é quanto uma chamada de DM toca antes de terminar sem resposta.
const RingTimeout = 45 * time.Second

// DMInvite é o convite de uma chamada de DM recém-criada, para quem observa de fora (push do app mobile).
type DMInvite struct {
	CallID         string
	ConversationID string
	CalleeID       string
	InitiatorName  string
}

// SetOfflineRinger diz quem pode receber chamada de DM mesmo sem estar online (ex.: tem o app no celular
// com push registrado). Vale só para decidir se a chamada toca: a presença (HandleDisconnect) segue o isOnline.
func (s *Service) SetOfflineRinger(fn func(userID string) bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.offlineRinger = fn
}

// OnDMInvite registra quem quer saber que uma chamada de DM começou a tocar.
func (s *Service) OnDMInvite(fn func(DMInvite)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onDMInvite = append(s.onDMInvite, fn)
}

func (s *Service) notifyDMInvite(invite DMInvite) {
	s.mu.RLock()
	hooks := append([]func(DMInvite){}, s.onDMInvite...)
	s.mu.RUnlock()
	for _, fn := range hooks {
		fn(invite)
	}
}

// calleeReachable: o chamado está online ou, offline, tem como ser avisado por push.
func (s *Service) calleeReachable(userID string) bool {
	if s.isOnline == nil || s.isOnline(userID) {
		return true
	}
	s.mu.RLock()
	ringer := s.offlineRinger
	s.mu.RUnlock()
	return ringer != nil && ringer(userID)
}

// scheduleRingTimeout encerra a chamada de DM se ninguém atender a tempo.
func (s *Service) scheduleRingTimeout(callID string) {
	timeout := s.ringTimeout
	if timeout <= 0 {
		timeout = RingTimeout
	}
	time.AfterFunc(timeout, func() { s.expireRinging(callID) })
}

// expireRinging termina a chamada que continua tocando (atendida ou já encerrada não é tocada).
func (s *Service) expireRinging(callID string) {
	s.mu.RLock()
	ac, ok := s.calls[callID]
	ringing := ok && ac.info.Status == StatusRinging
	inviteeID := ""
	if ok {
		inviteeID = ac.inviteeID
	}
	s.mu.RUnlock()
	if !ringing {
		return
	}
	event := marshalEvent("call:ended", EndedEvent{CallID: callID})
	if inviteeID != "" {
		s.publisher.SendToUser(inviteeID, event)
	}
	_ = s.End(context.Background(), callID)
}
