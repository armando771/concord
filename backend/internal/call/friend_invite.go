package call

import (
	"context"
	"errors"
	"time"
)

// Convite de amigos para a chamada de um canal de voz. Segue o molde do
// lock.go (pedido pendente em memória, com timer de expiração e eventos por
// SendToUser). Aceitar não põe ninguém na chamada pelo servidor: dá o passe
// curto (admitted) e o cliente do convidado entra pelo fluxo normal, que
// valida permissão, sala trancada e "ocupado em outra chamada".

var (
	ErrNoInvite         = errors.New("esse convite não existe mais")
	ErrNoInvitees       = errors.New("escolha pelo menos um amigo para convidar")
	ErrTooManyInvitees  = errors.New("convide no máximo 20 amigos por vez")
	ErrInviteNotAllowed = errors.New("só quem está na chamada pode convidar")
)

const (
	// Quanto tempo um convite fica aberto sem resposta.
	inviteTTL = 60 * time.Second
	// Espera depois de uma recusa para convidar a mesma pessoa de novo.
	inviteCooldown = 30 * time.Second
	// Máximo de pessoas por requisição (anti-spam).
	maxInviteesPerRequest = 20
)

// Resultado de cada convidado na requisição de envio.
const (
	InviteSent           = "sent"
	InviteAlreadyInvited = "already_invited"
	InviteAlreadyInCall  = "already_in_call"
	InviteNotFriend      = "not_friend"
	InviteBlocked        = "blocked"
	InviteOffline        = "offline"
	InviteBusy           = "busy"
	InviteNoAccess       = "no_access"
	InviteCooldown       = "cooldown"
)

// Estado final de um convite (call:friend_invite_update).
const (
	InviteAccepted  = "accepted"
	InviteDeclined  = "declined"
	InviteExpired   = "expired"
	InviteCancelled = "cancelled"
)

// FriendChecker é o que a chamada usa do friendship.Service.
type FriendChecker interface {
	AreFriends(ctx context.Context, a, b string) (bool, error)
}

// SetFriendChecker liga a checagem de amizade dos convites.
func (s *Service) SetFriendChecker(f FriendChecker) { s.friends = f }

// InviteResult: o que aconteceu com cada convidado da requisição.
type InviteResult struct {
	UserID string `json:"user_id"`
	Status string `json:"status"`
}

// FriendInviteEvent: convite recebido (call:friend_invite, só para o convidado).
type FriendInviteEvent struct {
	CallID      string    `json:"call_id"`
	ChannelID   *string   `json:"channel_id,omitempty"`
	ServerID    *string   `json:"server_id,omitempty"`
	ChannelName string    `json:"channel_name,omitempty"`
	ServerName  string    `json:"server_name,omitempty"`
	By          UserInfo  `json:"by"`
	ExpiresAt   time.Time `json:"expires_at"`
}

// FriendInviteUpdateEvent: o convite mudou de estado (call:friend_invite_update,
// para quem convidou e para o convidado).
type FriendInviteUpdateEvent struct {
	CallID string `json:"call_id"`
	UserID string `json:"user_id"`
	Status string `json:"status"`
}

type friendInvite struct {
	inviterID string
	timer     *time.Timer
}

// inviteBook guarda os convites de uma chamada (criado sob demanda).
type inviteBook struct {
	pending    map[string]*friendInvite // convidado -> convite aberto
	declinedAt map[string]time.Time     // convidado -> última recusa (anti-spam)
}

func (ac *activeCall) invitesLocked() *inviteBook {
	if ac.invites == nil {
		ac.invites = &inviteBook{
			pending:    make(map[string]*friendInvite),
			declinedAt: make(map[string]time.Time),
		}
	}
	return ac.invites
}

// takeInviteLocked tira o convite aberto e para o timer.
func takeInviteLocked(ac *activeCall, inviteeID string) (*friendInvite, bool) {
	if ac.invites == nil {
		return nil, false
	}
	inv, ok := ac.invites.pending[inviteeID]
	if !ok {
		return nil, false
	}
	delete(ac.invites.pending, inviteeID)
	if inv.timer != nil {
		inv.timer.Stop()
	}
	return inv, true
}

// cancelInvitesLocked esvazia os convites (chamada acabando): convidado -> quem convidou.
func cancelInvitesLocked(ac *activeCall) map[string]string {
	out := map[string]string{}
	if ac.invites == nil {
		return out
	}
	for uid, inv := range ac.invites.pending {
		takeInviteLocked(ac, uid)
		out[uid] = inv.inviterID
	}
	return out
}

// inviteContext: a chamada e quem convida, já validados.
type inviteContext struct {
	callID      string
	channelID   string
	serverID    *string
	channelName string
	serverName  string
	inviter     UserInfo
}

// InviteFriends convida vários amigos para a chamada de canal de voz.
// Valida tudo no servidor: o front só mostra o resultado de cada pessoa.
func (s *Service) InviteFriends(ctx context.Context, callID, inviterID string, userIDs []string) ([]InviteResult, error) {
	ids, err := normalizeInvitees(userIDs, inviterID)
	if err != nil {
		return nil, err
	}
	ic, err := s.inviteContext(ctx, callID, inviterID)
	if err != nil {
		return nil, err
	}
	results := make([]InviteResult, 0, len(ids))
	for _, id := range ids {
		results = append(results, InviteResult{UserID: id, Status: s.inviteOne(ctx, ic, id)})
	}
	return results, nil
}

// normalizeInvitees tira repetidos e o próprio convidador, e aplica o limite.
func normalizeInvitees(userIDs []string, inviterID string) ([]string, error) {
	seen := map[string]bool{inviterID: true}
	ids := make([]string, 0, len(userIDs))
	for _, id := range userIDs {
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return nil, ErrNoInvitees
	}
	if len(ids) > maxInviteesPerRequest {
		return nil, ErrTooManyInvitees
	}
	return ids, nil
}

func (s *Service) inviteContext(ctx context.Context, callID, inviterID string) (inviteContext, error) {
	s.mu.RLock()
	ac, ok := s.calls[callID]
	if !ok || ac.info.Status == StatusEnded {
		s.mu.RUnlock()
		return inviteContext{}, ErrNotFound
	}
	if ac.info.Type != TypeChannel || ac.info.ChannelID == nil {
		s.mu.RUnlock()
		return inviteContext{}, ErrNotChannelCall
	}
	_, in := ac.participants[inviterID]
	ic := inviteContext{callID: callID, channelID: *ac.info.ChannelID, serverID: ac.info.ServerID}
	s.mu.RUnlock()
	if !in {
		return inviteContext{}, ErrInviteNotAllowed
	}
	inviter, err := s.lookupUser(ctx, inviterID)
	if err != nil {
		return inviteContext{}, err
	}
	ic.inviter = inviter
	ic.channelName, ic.serverName = s.placeNames(ctx, ic.channelID, ic.serverID)
	return ic, nil
}

// placeNames busca o nome do canal e do servidor para o texto do convite
// (vazio se não der: o cliente tem fallback).
func (s *Service) placeNames(ctx context.Context, channelID string, serverID *string) (channelName, serverName string) {
	if s.channelService != nil {
		if ch, err := s.channelService.FindByID(ctx, channelID); err == nil && ch != nil {
			channelName = ch.Name
		}
	}
	if s.serverService != nil && serverID != nil {
		if srv, err := s.serverService.FindByID(ctx, *serverID); err == nil && srv != nil {
			serverName = srv.Name
		}
	}
	return channelName, serverName
}

// inviteOne valida um convidado e, estando tudo certo, registra e envia.
func (s *Service) inviteOne(ctx context.Context, ic inviteContext, inviteeID string) string {
	s.mu.RLock()
	st := s.inviteStateStatusLocked(ic.callID, inviteeID, time.Now())
	s.mu.RUnlock()
	if st != "" {
		return st
	}
	if st := s.inviteeEligibility(ctx, ic, inviteeID); st != "" {
		return st
	}
	return s.registerInvite(ic, inviteeID)
}

// inviteStateStatusLocked: motivos que dependem só do estado da chamada (sob s.mu).
func (s *Service) inviteStateStatusLocked(callID, inviteeID string, now time.Time) string {
	ac, ok := s.calls[callID]
	if !ok || ac.info.Status == StatusEnded {
		return InviteNoAccess
	}
	if _, in := ac.participants[inviteeID]; in {
		return InviteAlreadyInCall
	}
	if ac.invites != nil {
		if _, pending := ac.invites.pending[inviteeID]; pending {
			return InviteAlreadyInvited
		}
		if last, ok := ac.invites.declinedAt[inviteeID]; ok && now.Sub(last) < inviteCooldown {
			return InviteCooldown
		}
	}
	if other, busy := s.busy[inviteeID]; busy && other != callID {
		return InviteBusy
	}
	return ""
}

// inviteeEligibility: amizade, bloqueio, presença e acesso ao canal.
func (s *Service) inviteeEligibility(ctx context.Context, ic inviteContext, inviteeID string) string {
	if s.friends == nil {
		return InviteNotFriend
	}
	if ok, err := s.friends.AreFriends(ctx, ic.inviter.ID, inviteeID); err != nil || !ok {
		return InviteNotFriend
	}
	if s.blockedCheck != nil {
		if blocked, err := s.blockedCheck(ctx, ic.inviter.ID, inviteeID); err != nil || blocked {
			return InviteBlocked
		}
	}
	if s.isOnline == nil || !s.isOnline(inviteeID) {
		return InviteOffline
	}
	if s.requireConnect(ctx, ic.channelID, inviteeID) != nil {
		return InviteNoAccess
	}
	return ""
}

// registerInvite guarda o convite (rechecando o estado sob o mutex) e avisa.
func (s *Service) registerInvite(ic inviteContext, inviteeID string) string {
	now := time.Now()
	s.mu.Lock()
	if st := s.inviteStateStatusLocked(ic.callID, inviteeID, now); st != "" {
		s.mu.Unlock()
		return st
	}
	ac := s.calls[ic.callID]
	inv := &friendInvite{inviterID: ic.inviter.ID}
	inv.timer = time.AfterFunc(inviteTTL, func() { s.expireInvite(ic.callID, inviteeID, inv) })
	ac.invitesLocked().pending[inviteeID] = inv
	s.mu.Unlock()

	s.publisher.SendToUser(inviteeID, marshalEvent("call:friend_invite", FriendInviteEvent{
		CallID: ic.callID, ChannelID: &ic.channelID, ServerID: ic.serverID,
		ChannelName: ic.channelName, ServerName: ic.serverName,
		By: ic.inviter, ExpiresAt: now.Add(inviteTTL),
	}))
	return InviteSent
}

func (s *Service) expireInvite(callID, inviteeID string, inv *friendInvite) {
	s.mu.Lock()
	ac, ok := s.calls[callID]
	if !ok || ac.invites == nil || ac.invites.pending[inviteeID] != inv {
		s.mu.Unlock()
		return
	}
	takeInviteLocked(ac, inviteeID)
	// Entrou por outro caminho (sidebar) antes de responder: conta como aceito.
	_, joined := ac.participants[inviteeID]
	s.mu.Unlock()
	status := InviteExpired
	if joined {
		status = InviteAccepted
	}
	s.notifyInviteUpdate(callID, inv.inviterID, inviteeID, status)
}

// AcceptFriendInvite: o convidado aceita. Dá o passe de entrada (vale para sala
// trancada, já que quem convidou está dentro); o cliente entra pelo fluxo normal.
func (s *Service) AcceptFriendInvite(callID, inviteeID string) error {
	inv, err := s.closeInvite(callID, inviteeID, true)
	if err != nil {
		return err
	}
	s.notifyInviteUpdate(callID, inv.inviterID, inviteeID, InviteAccepted)
	return nil
}

// DeclineFriendInvite: o convidado recusa. A chamada segue (não usa Decline,
// que encerra a chamada de DM).
func (s *Service) DeclineFriendInvite(callID, inviteeID string) error {
	inv, err := s.closeInvite(callID, inviteeID, false)
	if err != nil {
		return err
	}
	s.notifyInviteUpdate(callID, inv.inviterID, inviteeID, InviteDeclined)
	return nil
}

func (s *Service) closeInvite(callID, inviteeID string, accept bool) (*friendInvite, error) {
	now := time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()
	ac, ok := s.calls[callID]
	if !ok || ac.info.Status == StatusEnded {
		return nil, ErrNotFound
	}
	inv, ok := takeInviteLocked(ac, inviteeID)
	if !ok {
		return nil, ErrNoInvite
	}
	if accept {
		admitLocked(ac, inviteeID, now.Add(admitTTL))
	} else {
		ac.invitesLocked().declinedAt[inviteeID] = now
	}
	return inv, nil
}

// notifyCancelledInvites avisa que a chamada acabou (convidado -> quem convidou).
func (s *Service) notifyCancelledInvites(callID string, cancelled map[string]string) {
	for inviteeID, inviterID := range cancelled {
		s.notifyInviteUpdate(callID, inviterID, inviteeID, InviteCancelled)
	}
}

func (s *Service) notifyInviteUpdate(callID, inviterID, inviteeID, status string) {
	ev := marshalEvent("call:friend_invite_update", FriendInviteUpdateEvent{CallID: callID, UserID: inviteeID, Status: status})
	s.publisher.SendToUser(inviterID, ev)
	s.publisher.SendToUser(inviteeID, ev)
}
