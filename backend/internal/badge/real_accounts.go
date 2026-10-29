package badge

import (
	"context"
	"fmt"
	"log"
	"time"

	"gin-quickstart/backend/internal/call"

	"github.com/jackc/pgx/v5"
)

// Conta real (anti-farm do Festeiro, do Amigos e do nível do servidor): não
// é bot e confirmou o e-mail, sem prazo de idade da conta. Só elas fazem
// número no pico da call, contam como amigo e dão XP ao servidor. A função SQL
// server_level_real (migration 000170) tem a mesma regra; contareal_test.go
// trava os dois.

// contaRealSQL é a condição "u é conta real" (alias da tabela de users).
func contaRealSQL(alias string) string {
	return fmt.Sprintf("(NOT %[1]s.is_bot AND %[1]s.email_verified_at IS NOT NULL)", alias)
}

// RealAccountSource diz quais destes usuários são contas reais (Repository).
type RealAccountSource interface {
	RealAccounts(ctx context.Context, userIDs []string) (map[string]bool, error)
}

const (
	// Quem confirma o e-mail vira conta real em até 10 min.
	realAccountTTL     = 10 * time.Minute
	realAccountTimeout = 2 * time.Second
	realAccountErrLog  = 10 * time.Minute
)

// RealAccountCache guarda, só de quem está em call, se é conta real e quando
// foi conferido. Só um tick usa (sem mutex). Também serve ao nível do
// servidor (internal/serverlevel), que conta as mesmas contas reais.
type RealAccountCache struct {
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
	s.real = NewRealAccountCache(src)
	return s
}

// NewRealAccountCache monta o cache sobre a fonte (o Repository).
func NewRealAccountCache(src RealAccountSource) *RealAccountCache {
	return &RealAccountCache{src: src, checked: make(map[string]realEntry)}
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
	return s.real.Lookup(ctx, ids, now)
}

// Lookup consulta o banco só para quem não foi conferido nos últimos 10 min.
// Banco fora do ar: quem nunca foi conferido não conta neste tick. Quem não
// está em ids sai do cache.
func (r *RealAccountCache) Lookup(ctx context.Context, ids []string, now time.Time) map[string]bool {
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

func (r *RealAccountCache) refresh(ctx context.Context, ids []string, now time.Time) {
	cctx, cancel := context.WithTimeout(ctx, realAccountTimeout)
	defer cancel()
	real, err := r.src.RealAccounts(cctx, ids)
	if err != nil {
		if now.Sub(r.errAt) >= realAccountErrLog {
			r.errAt = now
			log.Printf("[contas reais] %v", err)
		}
		return
	}
	for _, id := range ids {
		r.checked[id] = realEntry{real: real[id], at: now}
	}
}

// RealAccounts: quais destes usuários são contas reais.
func (r *Repository) RealAccounts(ctx context.Context, userIDs []string) (map[string]bool, error) {
	// Erro do Query volta pelo CollectRows (idioma do pgx).
	rows, _ := r.db.Query(ctx, `
		SELECT u.id::text FROM users u
		WHERE u.id = ANY($1::uuid[])
		  AND `+contaRealSQL("u"), userIDs)
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
