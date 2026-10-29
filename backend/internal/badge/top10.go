package badge

import (
	"context"
	"log"

	"gin-quickstart/backend/internal/level"
)

const (
	// Top10Slots: quantas pessoas ganham o Top 10 do nível 100.
	Top10Slots = 10
	// Top10Level: o nível que dá direito a uma vaga.
	Top10Level = 100
)

// claimTop10: quem chegou ao nível 100 e ainda não tem vaga tenta uma das
// dez (o banco garante a ordem de chegada). Quando as vagas acabam, o
// serviço guarda isso e para de perguntar. Falha só vai para o log: tenta de
// novo na próxima avaliação.
func (s *Service) claimTop10(ctx context.Context, userID string, st *Stats) {
	if st.Top10Rank > 0 || s.top10Full.Load() {
		return
	}
	if lvl, _, _ := level.FromXP(st.XP); lvl < Top10Level {
		return
	}
	rank, err := s.store.ClaimTop10(ctx, userID)
	if err != nil {
		log.Printf("[badge] top10 de %s: %v", userID, err)
		return
	}
	if rank == 0 {
		s.top10Full.Store(true)
		st.Top10Full = true
		return
	}
	st.Top10Rank = rank
}
