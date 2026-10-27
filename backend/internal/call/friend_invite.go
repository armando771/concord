package call

import (
	"context"
	"errors"
	"time"

	"gin-quickstart/backend/internal/channel"
	"gin-quickstart/backend/internal/server"
)

// Convite de amigos para a chamada de um canal de voz. O convite é uma
// mensagem na DM do convidador com o amigo (cartão com o botão "Abrir"); aqui
// ficam as regras de quem pode ser convidado e o registro em memória de quem
// já foi (anti-spam, passe de entrada e aviso quando a chamada acaba). Abrir
// não põe ninguém na chamada pelo servidor: dá o passe curto (admitted) e o
// cliente entra pelo fluxo normal, que valida permissão, sala trancada e
// "ocupado em outra chamada".

var (
	ErrNoInvitees       = errors.New("escolha pelo menos um amigo para convidar")
	ErrTooManyInvitees  = errors.New("convide no máximo 20 amigos por vez")
	ErrInviteNotAllowed = errors.New("só quem está na chamada pode convidar")
)

const (
	// Depois disso o mesmo amigo pode ser convidado de novo para a mesma
	// chamada (antes, "já convidado"): segura o spam sem prender a pessoa.
	inviteResendAfter = 60 * time.Second
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
	InviteBusy           = "busy"
	InviteNoAccess       = "no_access"
	// A mensagem na DM não pôde ser postada.
	InviteFailed = "failed"
)

// FriendChecker é o que a chamada usa do friendship.Service.
type FriendChecker interface {
	AreFriends(ctx context.Context, a, b string) (bool, error)
}

// SetFriendChecker liga a checagem de amizade dos convites.
func (s *Service) SetFriendChecker(f FriendChecker) { s.invite.friends = f }

// InviteCard: o que o cartão do convite guarda (a foto do momento do convite).
type InviteCard struct {
	CallID      string
	ChannelID   string
	ServerID    *string
	ChannelName string
	ServerName  string
}

// InviteDMPoster posta o cartão de convite na DM entre quem convida e o amigo
// (cria a conversa se não existir, respeitando as regras de DM).
type InviteDMPoster interface {
	PostCallInvite(ctx context.Context, inviterID, inviteeID string, card InviteCard) error
}

// inviteDeps: o que o convite de amigos usa de fora do pacote (ligado em cmd/wire_calls.go).
type inviteDeps struct {
	friends      FriendChecker
	channelNames channelFinder
	serverNames  serverFinder
	poster       InviteDMPoster
}

// SetInvitePoster liga o envio do convite para a DM.
func (s *Service) SetInvitePoster(p InviteDMPoster) { s.invite.poster = p }

// InviteResult: o que aconteceu com cada convidado da requisição.
type InviteResult struct {
	UserID string `json:"user_id"`
	Status string `json:"status"`
}

// InviteEndedEvent: a chamada do convite acabou (call:invite_ended, para quem
// convidou e para os convidados). O cartão na DM vira "Convite inválido".
type InviteEndedEvent struct {
	CallID string `json:"call_id"`
}

// invitation: um convite já enviado (em memória, vale enquanto a chamada durar).
type invitation struct {
	inviterID string
	at        time.Time
}

// inviteBook guarda os convites de uma chamada (criado sob demanda).
type inviteBook struct {
	sent map[string]invitation // convidado -> último convite
}

func (ac *activeCall) invitesLocked() *inviteBook {
	if ac.invites == nil {
		ac.invites = &inviteBook{sent: make(map[string]invitation)}
	}
	return ac.invites
}

// cancelInvitesLocked esvazia os convites (chamada acabando): convidado -> quem convidou.
func cancelInvitesLocked(ac *activeCall) map[string]string {
	out := map[string]string{}
	if ac.invites == nil {
		return out
	}
	for uid, inv := range ac.invites.sent {
		out[uid] = inv.inviterID
	}
	ac.invites = nil
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

// channelFinder e serverFinder: o que o convite usa de channel.Service e server.Service.
type channelFinder interface {
	FindByID(ctx context.Context, id string) (*channel.Channel, error)
}

type serverFinder interface {
	FindByID(ctx context.Context, id string) (*server.Server, error)
}

// SetPlaceSources liga a busca do nome do canal e do servidor (texto do convite).
func (s *Service) SetPlaceSources(ch channelFinder, srv serverFinder) {
	s.invite.channelNames, s.invite.serverNames = ch, srv
}

// placeNames busca o nome do canal e do servidor para o cartão do convite
// (vazio se não der: o cliente tem fallback).
func (s *Service) placeNames(ctx context.Context, channelID string, serverID *string) (channelName, serverName string) {
	if s.invite.channelNames != nil {
		if ch, err := s.invite.channelNames.FindByID(ctx, channelID); err == nil && ch != nil {
			channelName = ch.Name
		}
	}
	if s.invite.serverNames != nil && serverID != nil {
		if srv, err := s.invite.serverNames.FindByID(ctx, *serverID); err == nil && srv != nil {
			serverName = srv.Name
		}
	}
	return channelName, serverName
}

// inviteOne valida um convidado e, estando tudo certo, registra e posta na DM.
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
	return s.sendInvite(ctx, ic, inviteeID)
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
		if last, ok := ac.invites.sent[inviteeID]; ok && now.Sub(last.at) < inviteResendAfter {
			return InviteAlreadyInvited
		}
	}
	if other, busy := s.busy[inviteeID]; busy && other != callID {
		return InviteBusy
	}
	return ""
}

// inviteeEligibility: amizade, bloqueio e acesso ao canal. Presença não conta:
// o convite fica salvo na DM e o amigo vê quando voltar.
func (s *Service) inviteeEligibility(ctx context.Context, ic inviteContext, inviteeID string) string {
	if s.invite.friends == nil {
		return InviteNotFriend
	}
	if ok, err := s.invite.friends.AreFriends(ctx, ic.inviter.ID, inviteeID); err != nil || !ok {
		return InviteNotFriend
	}
	if s.blockedCheck != nil {
		if blocked, err := s.blockedCheck(ctx, ic.inviter.ID, inviteeID); err != nil || blocked {
			return InviteBlocked
		}
	}
	if s.requireConnect(ctx, ic.channelID, inviteeID) != nil {
		return InviteNoAccess
	}
	return ""
}

// sendInvite reserva o convite (rechecando o estado sob o mutex, para duas
// requisições juntas não duplicarem) e posta o cartão na DM. Se a DM falhar,
// a reserva é desfeita.
func (s *Service) sendInvite(ctx context.Context, ic inviteContext, inviteeID string) string {
	if s.invite.poster == nil {
		return InviteFailed
	}
	prev, st := s.reserveInvite(ic, inviteeID)
	if st != "" {
		return st
	}
	card := InviteCard{
		CallID: ic.callID, ChannelID: ic.channelID, ServerID: ic.serverID,
		ChannelName: ic.channelName, ServerName: ic.serverName,
	}
	if err := s.invite.poster.PostCallInvite(ctx, ic.inviter.ID, inviteeID, card); err != nil {
		s.releaseInvite(ic.callID, inviteeID, prev)
		return InviteFailed
	}
	return InviteSent
}

// reserveInvite anota o convite; devolve o anterior (para desfazer) ou o motivo da recusa.
func (s *Service) reserveInvite(ic inviteContext, inviteeID string) (prev *invitation, status string) {
	now := time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()
	if st := s.inviteStateStatusLocked(ic.callID, inviteeID, now); st != "" {
		return nil, st
	}
	book := s.calls[ic.callID].invitesLocked()
	if old, ok := book.sent[inviteeID]; ok {
		prev = &old
	}
	book.sent[inviteeID] = invitation{inviterID: ic.inviter.ID, at: now}
	return prev, ""
}

func (s *Service) releaseInvite(callID, inviteeID string, prev *invitation) {
	s.mu.Lock()
	defer s.mu.Unlock()
	ac, ok := s.calls[callID]
	if !ok || ac.invites == nil {
		return
	}
	if prev != nil {
		ac.invites.sent[inviteeID] = *prev
		return
	}
	delete(ac.invites.sent, inviteeID)
}

// InviteValid: o convite ainda vale se a chamada existe e não acabou.
func (s *Service) InviteValid(callID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ac, ok := s.calls[callID]
	return ok && ac.info.Status != StatusEnded && ac.info.Type == TypeChannel
}

// OpenFriendInvite: o convidado clicou em "Abrir". Quem foi convidado ganha o
// passe de entrada (vale para sala trancada, já que quem convidou está dentro);
// o cliente entra pelo fluxo normal. Sem registro do convite (o servidor
// reiniciou) não há passe, mas a entrada normal segue valendo. Chamada que
// acabou é ErrNotFound.
func (s *Service) OpenFriendInvite(callID, userID string) (admitted bool, err error) {
	now := time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()
	ac, ok := s.calls[callID]
	if !ok || ac.info.Status == StatusEnded || ac.info.Type != TypeChannel {
		return false, ErrNotFound
	}
	if ac.invites == nil {
		return false, nil
	}
	if _, invited := ac.invites.sent[userID]; !invited {
		return false, nil
	}
	admitLocked(ac, userID, now.Add(admitTTL))
	return true, nil
}

// notifyCancelledInvites avisa que a chamada acabou: cada convidado e cada
// convidador recebe um call:invite_ended (uma vez).
func (s *Service) notifyCancelledInvites(callID string, cancelled map[string]string) {
	ev := marshalEvent("call:invite_ended", InviteEndedEvent{CallID: callID})
	notified := map[string]bool{}
	for inviteeID, inviterID := range cancelled {
		for _, uid := range []string{inviteeID, inviterID} {
			if !notified[uid] {
				notified[uid] = true
				s.publisher.SendToUser(uid, ev)
			}
		}
	}
}
