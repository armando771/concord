package call

import (
	"context"
	"log"
)

// RestoreActive recoloca em memória as chamadas que estavam ativas quando o
// servidor reiniciou (o estado das chamadas vive em memória; o banco guarda o
// histórico). A mídia segue no LiveKit, então quem reconectar o WebSocket
// dentro da tolerância continua na chamada sem perceber; quem não voltar sai.
func (s *Service) RestoreActive(ctx context.Context) {
	calls, err := s.repository.ListUnended(ctx)
	if err != nil {
		log.Printf("[call] restore: %v", err)
		return
	}
	participants := make(map[string][]CallParticipant, len(calls))
	for _, c := range calls {
		list, err := s.repository.ListParticipants(ctx, c.ID)
		if err != nil {
			log.Printf("[call] restore participants %s: %v", c.ID, err)
			continue
		}
		participants[c.ID] = list
	}

	for _, id := range s.restore(calls, participants) {
		if err := s.repository.EndCall(ctx, id); err != nil {
			log.Printf("[call] restore end %s: %v", id, err)
		}
	}

	// Quem estava na chamada tem o prazo normal para reconectar.
	s.mu.RLock()
	users := make([]string, 0, len(s.busy))
	for userID := range s.busy {
		users = append(users, userID)
	}
	s.mu.RUnlock()
	for _, userID := range users {
		s.HandleDisconnect(userID)
	}
	log.Printf("[call] restore: %d chamada(s) ativa(s), %d participante(s)", len(s.calls), len(users))
}

// restore monta o estado em memória e devolve as chamadas a encerrar: as que
// só estavam tocando (ninguém atendeu antes de reiniciar) e as sem ninguém.
func (s *Service) restore(calls []*Call, participants map[string][]CallParticipant) []string {
	s.mu.Lock()
	defer s.mu.Unlock()

	var toEnd []string
	for _, c := range calls {
		if c.Status != StatusActive {
			toEnd = append(toEnd, c.ID)
			continue
		}
		ac := &activeCall{info: c, participants: make(map[string]*participantState)}
		for _, p := range participants[c.ID] {
			if p.LeftAt != nil {
				continue
			}
			ac.participants[p.UserID] = &participantState{
				userID:   p.UserID,
				role:     p.Role,
				joinedAt: p.JoinedAt,
			}
		}
		if len(ac.participants) == 0 {
			toEnd = append(toEnd, c.ID)
			continue
		}
		s.calls[c.ID] = ac
		for userID := range ac.participants {
			s.busy[userID] = c.ID
		}
	}
	return toEnd
}
