package call

import (
	"context"
	"errors"
	"sort"
	"time"
)

// Sala de voz trancada: quem está dentro tranca/destranca; quem chega pede
// para entrar ("bate na porta") e qualquer participante aceita ou recusa.
// Aceitar não põe ninguém na chamada pelo servidor: dá um passe curto
// (admitted) e avisa o cliente do solicitante, que entra pelo fluxo normal.

var (
	ErrLocked        = errors.New("call_locked")
	ErrKnockCooldown = errors.New("aguarde um pouco antes de pedir para entrar de novo")
	ErrNotLockable   = errors.New("só salas de voz podem ser trancadas")
)

const (
	// Quanto tempo um pedido fica aberto sem resposta.
	knockTTL = 60 * time.Second
	// Espera depois de uma recusa para pedir de novo.
	knockCooldown = 30 * time.Second
	// Validade do passe de quem foi aceito (tempo de abrir mic e entrar).
	admitTTL = 60 * time.Second
	// Quem caiu (rede/atualização do app) volta sem pedir dentro desse prazo.
	rejoinTTL = 2 * time.Minute
)

const (
	KnockAccepted  = "accepted"
	KnockDeclined  = "declined"
	KnockCancelled = "cancelled"
	KnockExpired   = "expired"
	KnockUnlocked  = "unlocked"
	KnockEnded     = "ended"
)

type joinRequest struct {
	user        UserInfo
	requestedAt time.Time
	timer       *time.Timer
}

// LockEvent: sala trancada/destrancada. Vai para a chamada e para o servidor
// (cadeado na lista de canais de voz).
type LockEvent struct {
	CallID    string   `json:"call_id"`
	ChannelID *string  `json:"channel_id,omitempty"`
	Locked    bool     `json:"locked"`
	By        UserInfo `json:"by"`
}

// KnockEvent: alguém pediu para entrar (vai para quem está na chamada).
type KnockEvent struct {
	CallID      string    `json:"call_id"`
	ChannelID   *string   `json:"channel_id,omitempty"`
	User        UserInfo  `json:"user"`
	RequestedAt time.Time `json:"requested_at"`
}

// KnockResolvedEvent: o pedido saiu da fila (fecha o card de todo mundo).
type KnockResolvedEvent struct {
	CallID   string    `json:"call_id"`
	UserID   string    `json:"user_id"`
	Accepted bool      `json:"accepted"`
	Reason   string    `json:"reason"`
	By       *UserInfo `json:"by,omitempty"`
}

// KnockAnswerEvent: resposta para quem pediu (call:knock_accepted/declined).
type KnockAnswerEvent struct {
	CallID    string    `json:"call_id"`
	ChannelID *string   `json:"channel_id,omitempty"`
	ServerID  *string   `json:"server_id,omitempty"`
	Reason    string    `json:"reason"`
	By        *UserInfo `json:"by,omitempty"`
}

type LockPayload struct {
	CallID string `json:"call_id"`
	Locked bool   `json:"locked"`
}

type KnockRespondPayload struct {
	CallID string `json:"call_id"`
	UserID string `json:"user_id"`
	Accept bool   `json:"accept"`
}

// knockAnswer guarda uma resposta a enviar depois de soltar o mutex.
type knockAnswer struct {
	userID   string
	accepted bool
	reason   string
}

// canEnterLockedLocked diz se userID pode entrar agora em ac (sob s.mu).
// Consome o passe de quem foi aceito.
func canEnterLockedLocked(ac *activeCall, userID string, now time.Time) bool {
	if !ac.info.Locked {
		return true
	}
	if _, ok := ac.participants[userID]; ok {
		return true
	}
	if until, ok := ac.admitted[userID]; ok {
		delete(ac.admitted, userID)
		return now.Before(until)
	}
	return false
}

func admitLocked(ac *activeCall, userID string, until time.Time) {
	if ac.admitted == nil {
		ac.admitted = make(map[string]time.Time)
	}
	ac.admitted[userID] = until
}

// takeRequestLocked tira o pedido da fila e para o timer de expiração.
func takeRequestLocked(ac *activeCall, userID string) (*joinRequest, bool) {
	req, ok := ac.joinRequests[userID]
	if !ok {
		return nil, false
	}
	delete(ac.joinRequests, userID)
	if req.timer != nil {
		req.timer.Stop()
	}
	return req, true
}

// SetLocked tranca/destranca a sala. Só participantes de chamadas de canal.
// Destrancar aceita todos os pedidos pendentes.
func (s *Service) SetLocked(ctx context.Context, callID, userID string, locked bool) error {
	by, err := s.lookupUser(ctx, userID)
	if err != nil {
		return err
	}

	s.mu.Lock()
	ac, ok := s.calls[callID]
	if !ok || ac.info.Status == StatusEnded {
		s.mu.Unlock()
		return ErrNotFound
	}
	if ac.info.Type != TypeChannel {
		s.mu.Unlock()
		return ErrNotLockable
	}
	if _, ok := ac.participants[userID]; !ok {
		s.mu.Unlock()
		return ErrNotAllowed
	}
	if ac.info.Locked == locked {
		s.mu.Unlock()
		return nil
	}
	ac.info.Locked = locked
	answers := []knockAnswer{}
	if !locked {
		now := time.Now()
		for uid := range ac.joinRequests {
			takeRequestLocked(ac, uid)
			admitLocked(ac, uid, now.Add(admitTTL))
			answers = append(answers, knockAnswer{userID: uid, accepted: true, reason: KnockUnlocked})
		}
	}
	channelID, serverID := ac.info.ChannelID, ac.info.ServerID
	s.mu.Unlock()

	event := marshalEvent("call:lock", LockEvent{CallID: callID, ChannelID: channelID, Locked: locked, By: by})
	s.publisher.BroadcastToCall(callID, event)
	if serverID != nil {
		s.publisher.BroadcastToRoom("server:"+*serverID, event)
	}
	s.sendKnockAnswers(callID, channelID, serverID, &by, answers)
	return nil
}

// RequestJoin registra o pedido de userID para entrar na sala trancada.
func (s *Service) RequestJoin(ctx context.Context, callID, userID string) error {
	s.mu.RLock()
	ac, ok := s.calls[callID]
	if !ok || ac.info.Status == StatusEnded || ac.info.Type != TypeChannel {
		s.mu.RUnlock()
		return ErrNotFound
	}
	var serverID string
	if ac.info.ServerID != nil {
		serverID = *ac.info.ServerID
	}
	s.mu.RUnlock()

	if s.serverService != nil {
		isMember, err := s.serverService.IsMember(ctx, serverID, userID)
		if err != nil || !isMember {
			return ErrNotMember
		}
	}
	user, err := s.lookupUser(ctx, userID)
	if err != nil {
		return err
	}

	now := time.Now()
	s.mu.Lock()
	ac, ok = s.calls[callID]
	if !ok || ac.info.Status == StatusEnded {
		s.mu.Unlock()
		return ErrNotFound
	}
	channelID, srvID := ac.info.ChannelID, ac.info.ServerID
	if _, in := ac.participants[userID]; in {
		s.mu.Unlock()
		return nil
	}
	if !ac.info.Locked {
		// Destrancou enquanto ele clicava: pode entrar direto.
		admitLocked(ac, userID, now.Add(admitTTL))
		s.mu.Unlock()
		s.sendKnockAnswers(callID, channelID, srvID, nil, []knockAnswer{{userID: userID, accepted: true, reason: KnockUnlocked}})
		return nil
	}
	if last, ok := ac.declinedAt[userID]; ok && now.Sub(last) < knockCooldown {
		s.mu.Unlock()
		return ErrKnockCooldown
	}
	if ac.joinRequests == nil {
		ac.joinRequests = make(map[string]*joinRequest)
	}
	if existing, ok := ac.joinRequests[userID]; ok {
		// Pedido repetido (ex.: reconectou): reavisa, sem duplicar.
		ev := KnockEvent{CallID: callID, ChannelID: channelID, User: existing.user, RequestedAt: existing.requestedAt}
		s.mu.Unlock()
		s.publisher.BroadcastToCall(callID, marshalEvent("call:knock", ev))
		return nil
	}
	req := &joinRequest{user: user, requestedAt: now}
	req.timer = time.AfterFunc(knockTTL, func() { s.expireRequest(callID, userID, req) })
	ac.joinRequests[userID] = req
	s.mu.Unlock()

	s.publisher.BroadcastToCall(callID, marshalEvent("call:knock", KnockEvent{
		CallID: callID, ChannelID: channelID, User: user, RequestedAt: now,
	}))
	return nil
}

func (s *Service) expireRequest(callID, userID string, req *joinRequest) {
	s.mu.Lock()
	ac, ok := s.calls[callID]
	if !ok || ac.joinRequests[userID] != req {
		s.mu.Unlock()
		return
	}
	delete(ac.joinRequests, userID)
	channelID, serverID := ac.info.ChannelID, ac.info.ServerID
	s.mu.Unlock()
	s.sendKnockAnswers(callID, channelID, serverID, nil, []knockAnswer{{userID: userID, reason: KnockExpired}})
}

// CancelJoinRequest: o solicitante desistiu.
func (s *Service) CancelJoinRequest(callID, userID string) error {
	s.mu.Lock()
	ac, ok := s.calls[callID]
	if !ok {
		s.mu.Unlock()
		return nil
	}
	_, had := takeRequestLocked(ac, userID)
	s.mu.Unlock()
	if had {
		s.publisher.BroadcastToCall(callID, marshalEvent("call:knock_resolved", KnockResolvedEvent{
			CallID: callID, UserID: userID, Reason: KnockCancelled,
		}))
	}
	return nil
}

// RespondJoinRequest: um participante aceita/recusa. O primeiro a responder
// vence; respostas atrasadas são ignoradas.
func (s *Service) RespondJoinRequest(ctx context.Context, callID, responderID, targetID string, accept bool) error {
	by, err := s.lookupUser(ctx, responderID)
	if err != nil {
		return err
	}

	now := time.Now()
	s.mu.Lock()
	ac, ok := s.calls[callID]
	if !ok || ac.info.Status == StatusEnded {
		s.mu.Unlock()
		return ErrNotFound
	}
	if _, ok := ac.participants[responderID]; !ok {
		s.mu.Unlock()
		return ErrNotAllowed
	}
	if _, ok := takeRequestLocked(ac, targetID); !ok {
		s.mu.Unlock()
		return nil
	}
	reason := KnockDeclined
	if accept {
		reason = KnockAccepted
		admitLocked(ac, targetID, now.Add(admitTTL))
	} else {
		if ac.declinedAt == nil {
			ac.declinedAt = make(map[string]time.Time)
		}
		ac.declinedAt[targetID] = now
	}
	channelID, serverID := ac.info.ChannelID, ac.info.ServerID
	s.mu.Unlock()

	s.sendKnockAnswers(callID, channelID, serverID, &by, []knockAnswer{{userID: targetID, accepted: accept, reason: reason}})
	return nil
}

// sendKnockAnswers fecha os pedidos para quem está na chamada e responde a
// cada solicitante.
func (s *Service) sendKnockAnswers(callID string, channelID, serverID *string, by *UserInfo, answers []knockAnswer) {
	for _, a := range answers {
		s.publisher.BroadcastToCall(callID, marshalEvent("call:knock_resolved", KnockResolvedEvent{
			CallID: callID, UserID: a.userID, Accepted: a.accepted, Reason: a.reason, By: by,
		}))
		typ := "call:knock_declined"
		if a.accepted {
			typ = "call:knock_accepted"
		}
		s.publisher.SendToUser(a.userID, marshalEvent(typ, KnockAnswerEvent{
			CallID: callID, ChannelID: channelID, ServerID: serverID, Reason: a.reason, By: by,
		}))
	}
}

// pendingRequesters esvazia a fila (chamada acabando) e diz quem avisar.
func pendingRequestersLocked(ac *activeCall) []string {
	ids := make([]string, 0, len(ac.joinRequests))
	for uid := range ac.joinRequests {
		takeRequestLocked(ac, uid)
		ids = append(ids, uid)
	}
	return ids
}

// joinRequestsOf lista os pedidos abertos (para o estado da chamada).
func (s *Service) joinRequestsOf(callID string) []UserInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ac, ok := s.calls[callID]
	if !ok || len(ac.joinRequests) == 0 {
		return nil
	}
	reqs := make([]*joinRequest, 0, len(ac.joinRequests))
	for _, r := range ac.joinRequests {
		reqs = append(reqs, r)
	}
	sort.Slice(reqs, func(i, j int) bool { return reqs[i].requestedAt.Before(reqs[j].requestedAt) })
	out := make([]UserInfo, 0, len(reqs))
	for _, r := range reqs {
		out = append(out, r.user)
	}
	return out
}

// cancelKnocksBy tira os pedidos de userID de todas as salas (ficou offline).
func (s *Service) cancelKnocksBy(userID string) {
	s.mu.RLock()
	callIDs := []string{}
	for id, ac := range s.calls {
		if _, ok := ac.joinRequests[userID]; ok {
			callIDs = append(callIDs, id)
		}
	}
	s.mu.RUnlock()
	for _, id := range callIDs {
		_ = s.CancelJoinRequest(id, userID)
	}
}

// sendKnockError avisa um erro de tranca/pedido sem derrubar a chamada de
// quem recebe (call:error encerra a chamada no cliente).
func (s *Service) sendKnockError(userID, callID string, err error) {
	message := err.Error()
	switch {
	case errors.Is(err, ErrNotAllowed):
		message = "só quem está na sala pode fazer isso"
	case errors.Is(err, ErrNotFound):
		message = "a chamada não existe mais"
	case errors.Is(err, ErrNotMember):
		message = "você não é membro deste servidor"
	}
	s.publisher.SendToUser(userID, marshalEvent("call:knock_error", ErrorEvent{
		CallID:  callID,
		Message: message,
	}))
}
