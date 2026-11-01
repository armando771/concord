package call

import "time"

// Registro em memória dos convites de uma chamada (vale enquanto ela durar):
// quem convidou quem, se o convite (uso único) já foi gasto e o aviso quando a
// chamada acaba. As regras de quem pode ser convidado ficam em friend_invite.go.

// InviteEndedEvent: a chamada do convite acabou (call:invite_ended, para quem
// convidou e para os convidados). O cartão na DM vira "Convite inválido".
type InviteEndedEvent struct {
	CallID string `json:"call_id"`
	// InviteRoleInvitee: só o cartão de quem recebeu (o convite foi usado).
	// Vazio: a chamada acabou, vale para todos os cartões.
	Role string `json:"role,omitempty"`
}

// Papéis do cartão de convite.
const InviteRoleInvitee = "invitee"

// invitation: um convite já enviado (em memória, vale enquanto a chamada durar).
type invitation struct {
	inviterID string
	at        time.Time
	// used: o convidado entrou na chamada; o convite (uso único) não vale mais.
	used bool
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

// InviteValid: o cartão ainda vale para quem pergunta. Para quem convidou
// (asInviter), enquanto a chamada durar. Para o convidado, só se ele tem um
// convite não usado e ainda não está na chamada (uso único).
func (s *Service) InviteValid(callID, userID string, asInviter bool) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ac, ok := s.calls[callID]
	if !ok || ac.info.Status == StatusEnded || ac.info.Type != TypeChannel {
		return false
	}
	return asInviter || inviteUsableLocked(ac, userID)
}

// inviteUsableLocked: userID tem convite não usado e está fora da chamada (sob s.mu).
func inviteUsableLocked(ac *activeCall, userID string) bool {
	if ac.invites == nil {
		return false
	}
	inv, invited := ac.invites.sent[userID]
	if !invited || inv.used {
		return false
	}
	_, in := ac.participants[userID]
	return !in
}

// consumeInviteLocked gasta o convite de quem acabou de entrar na chamada e o
// avisa, para o cartão dele virar "Convite inválido" na hora (sob s.mu).
func (s *Service) consumeInviteLocked(ac *activeCall, userID string) {
	if ac.invites == nil {
		return
	}
	inv, ok := ac.invites.sent[userID]
	if !ok || inv.used {
		return
	}
	inv.used = true
	ac.invites.sent[userID] = inv
	s.publisher.SendToUser(userID, marshalEvent("call:invite_ended", InviteEndedEvent{
		CallID: ac.info.ID, Role: InviteRoleInvitee,
	}))
}

// OpenFriendInvite: o convidado clicou em "Abrir". Quem foi convidado ganha o
// passe de entrada (vale para sala trancada, já que quem convidou está dentro);
// o cliente entra pelo fluxo normal. Sem registro do convite (o servidor
// reiniciou) o convite não vale mais (ErrInviteInvalid), assim como o já usado.
// Chamada que acabou é ErrNotFound.
func (s *Service) OpenFriendInvite(callID, userID string) (admitted bool, err error) {
	now := time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()
	ac, ok := s.calls[callID]
	if !ok || ac.info.Status == StatusEnded || ac.info.Type != TypeChannel {
		return false, ErrNotFound
	}
	if !inviteUsableLocked(ac, userID) {
		return false, ErrInviteInvalid
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
