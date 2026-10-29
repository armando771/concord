package badge

import (
	"context"
	"log"
	"time"
)

// Sequência: um dia de uso por pessoa, gravado pelo tick para quem está
// online (a cada minuto). Na memória fica quem já foi gravado hoje, para o
// banco receber uma linha por pessoa por dia.

// activeDays lembra quem já teve o dia `day` gravado.
type activeDays struct {
	day  string
	seen map[string]bool
}

// fresh devolve, dos ids, os que ainda não foram gravados no dia, e os marca.
// Dia novo esquece o anterior.
func (a *activeDays) fresh(day string, ids []string) []string {
	if a.day != day || a.seen == nil {
		a.day, a.seen = day, map[string]bool{}
	}
	var out []string
	for _, id := range ids {
		if !a.seen[id] {
			a.seen[id] = true
			out = append(out, id)
		}
	}
	return out
}

// forget desmarca quem não foi gravado (falha no banco): vai no próximo.
func (a *activeDays) forget(ids []string) {
	for _, id := range ids {
		delete(a.seen, id)
	}
}

// recordActiveDays grava o dia de uso (Brasília) de quem está online e ainda
// não foi gravado hoje, e devolve essas pessoas para reavaliar.
func (s *Service) recordActiveDays(ctx context.Context, now time.Time) []string {
	if s.online == nil {
		return nil
	}
	day := now.In(s.tracker.loc).Format(time.DateOnly)
	ids := s.days.fresh(day, s.online.OnlineUserIDs())
	if len(ids) == 0 {
		return nil
	}
	if err := s.store.RecordActiveDay(ctx, ids, day); err != nil {
		log.Printf("[badge] gravar dia de uso: %v", err)
		s.days.forget(ids)
		return nil
	}
	return ids
}
