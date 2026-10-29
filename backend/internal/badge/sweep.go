package badge

import (
	"context"
	"log"
	"sort"
)

// Quem o tick reavalia depois de gravar: quem está em call, quem está online
// (na varredura) e quem teve um número novo. Extraído do service.go.

// touchVoice: quem está em call com XP também sobe Tempo em call e Nível.
func (s *Service) touchVoice(touched map[string]bool) {
	for _, snap := range s.calls.CallSnapshots() {
		for _, userID := range snap.Voice {
			touched[userID] = true
		}
	}
}

// touchOnline: quem está online e fora de call (mensagens, reações...).
func (s *Service) touchOnline(touched map[string]bool) {
	if s.online == nil {
		return
	}
	for _, userID := range s.online.OnlineUserIDs() {
		touched[userID] = true
	}
}

// syncAll reavalia cada um, em ordem (logs e testes previsíveis).
func (s *Service) syncAll(ctx context.Context, touched map[string]bool) {
	ids := make([]string, 0, len(touched))
	for userID := range touched {
		ids = append(ids, userID)
	}
	sort.Strings(ids)
	for _, userID := range ids {
		if _, _, err := s.sync(ctx, userID); err != nil {
			log.Printf("[badge] sync %s: %v", userID, err)
		}
	}
}
