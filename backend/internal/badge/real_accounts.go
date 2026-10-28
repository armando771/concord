package badge

import (
	"context"
	"fmt"
	"log"
	"time"

	"gin-quickstart/backend/internal/call"

	"github.com/jackc/pgx/v5"
)

// Conta real (anti-farm do Festeiro): e-mail confirmado e conta criada há
// 7 dias ou mais. Só elas fazem número no pico da call e levam o crédito.

// RealAccountSource diz quais destes usuários são contas reais (Repository).
type RealAccountSource interface {
	RealAccounts(ctx context.Context, userIDs []string) (map[string]bool, error)
}

const (
	// Uma conta nova vira real em até 10 min depois de fazer 7 dias.
	realAccountTTL     = 10 * time.Minute
	realAccountTimeout = 2 * time.Second
	realAccountErrLog  = 10 * time.Minute
)

// realAccounts guarda, só de quem está em call, se é conta real e quando
// foi conferido. Só o tick usa (sem mutex).
type realAccounts struct {
	src     RealAccountSource
	checked map[string]realEntry
	errAt   time.Time
}

type realEntry struct {
	real bool
	at   time.Time
}

// WithRealAccounts liga o filtro de contas reais do Festeiro. Sem ele, todo
// mundo conta.
func (s *Service) WithRealAccounts(src RealAccountSource) *Service {
	s.real = &realAccounts{src: src, checked: make(map[string]realEntry)}
	return s
}

// realAccountsIn: as contas reais entre quem pode fazer pico (calls com duas
// pessoas ouvindo). nil = filtro desligado.
func (s *Service) realAccountsIn(ctx context.Context, snaps []call.CallSnapshot, now time.Time) map[string]bool {
	if s.real == nil {
		return nil
	}
	var ids []string
	for _, snap := range snaps {
		if len(snap.Listeners) >= 2 {
			ids = append(ids, snap.Listeners...)
		}
	}
	return s.real.lookup(ctx, ids, now)
}

// lookup consulta o banco só para quem não foi conferido nos últimos 10 min.
// Banco fora do ar: quem nunca foi conferido não conta neste tick.
func (r *realAccounts) lookup(ctx context.Context, ids []string, now time.Time) map[string]bool {
	var stale []string
	for _, id := range ids {
		if e, ok := r.checked[id]; !ok || now.Sub(e.at) >= realAccountTTL {
			stale = append(stale, id)
		}
	}
	if len(stale) > 0 {
		r.refresh(ctx, stale, now)
	}
	out := make(map[string]bool, len(ids))
	for _, id := range ids {
		out[id] = r.checked[id].real
	}
	for id := range r.checked {
		if _, inCall := out[id]; !inCall {
			delete(r.checked, id)
		}
	}
	return out
}

func (r *realAccounts) refresh(ctx context.Context, ids []string, now time.Time) {
	cctx, cancel := context.WithTimeout(ctx, realAccountTimeout)
	defer cancel()
	real, err := r.src.RealAccounts(cctx, ids)
	if err != nil {
		if now.Sub(r.errAt) >= realAccountErrLog {
			r.errAt = now
			log.Printf("[badge] contas reais: %v", err)
		}
		return
	}
	for _, id := range ids {
		r.checked[id] = realEntry{real: real[id], at: now}
	}
}

// RealAccounts: quais destes usuários têm e-mail confirmado e conta com 7
// dias ou mais (a mesma regra do Amigos: amigoContaRealDias).
func (r *Repository) RealAccounts(ctx context.Context, userIDs []string) (map[string]bool, error) {
	// Erro do Query volta pelo CollectRows (idioma do pgx).
	rows, _ := r.db.Query(ctx, `
		SELECT id::text FROM users
		WHERE id = ANY($1::uuid[])
		  AND email_verified_at IS NOT NULL
		  AND created_at <= now() - make_interval(days => $2)`, userIDs, amigoContaRealDias)
	ids, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return nil, fmt.Errorf("contas reais: %w", err)
	}
	return idSet(ids), nil
}

func idSet(ids []string) map[string]bool {
	out := make(map[string]bool, len(ids))
	for _, id := range ids {
		out[id] = true
	}
	return out
}
