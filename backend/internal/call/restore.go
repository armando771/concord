package call

import (
	"context"
	"fmt"
	"log"
)

// restoreStore é o que a subida lê do banco (trocável nos testes).
type restoreStore interface {
	ListUnended(ctx context.Context) ([]*Call, error)
	ListParticipants(ctx context.Context, callID string) ([]CallParticipant, error)
	EndCall(ctx context.Context, id string) error
}

// RestoreActive recoloca em memória as chamadas que estavam ativas quando o
// servidor reiniciou (o estado das chamadas vive em memória; o banco guarda o
// histórico e o mudo/ensurdecido/tela de cada um). A mídia segue no LiveKit,
// então quem reconectar o WebSocket dentro da tolerância continua na chamada
// sem perceber; quem não voltar sai.
//
// Qualquer erro de leitura devolve erro sem mudar nada (nem memória nem
// banco): o servidor não fica pronto e quem chamou tenta de novo. Encerrar uma
// chamada porque a lista de participantes não veio derrubaria todo mundo.
func (s *Service) RestoreActive(ctx context.Context) error {
	calls, err := s.restoreStore.ListUnended(ctx)
	if err != nil {
		return fmt.Errorf("listar chamadas ativas: %w", err)
	}
	participants := make(map[string][]CallParticipant, len(calls))
	for _, c := range calls {
		list, err := s.restoreStore.ListParticipants(ctx, c.ID)
		if err != nil {
			return fmt.Errorf("participantes da chamada %s: %w", c.ID, err)
		}
		participants[c.ID] = list
	}

	for _, id := range s.restore(calls, participants) {
		// Só tocava ou estava vazia: encerrar é o certo; se falhar, ela fica
		// para a próxima subida.
		if err := s.restoreStore.EndCall(ctx, id); err != nil {
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
	return nil
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
				muted:    p.Muted,
				deafened: p.Deafened,
			}
		}
		if len(ac.participants) == 0 {
			toEnd = append(toEnd, c.ID)
			continue
		}
		s.calls[c.ID] = ac
		// Selo LIVE continua no ar: quem transmitia segue transmitindo (a mídia
		// nem passou pelo backend). O app reenvia o estado real ao reconectar.
		for _, p := range participants[c.ID] {
			if p.LeftAt != nil || !p.ScreenSharing {
				continue
			}
			if s.screenSharers[c.ID] == nil {
				s.screenSharers[c.ID] = make(map[string]struct{})
			}
			s.screenSharers[c.ID][p.UserID] = struct{}{}
		}
		for userID := range ac.participants {
			s.busy[userID] = c.ID
		}
	}
	return toEnd
}
