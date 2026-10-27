package badge

import (
	"context"

	"github.com/jackc/pgx/v5"
)

// top10LockKey trava a fila do Top 10 (pg_advisory_xact_lock) enquanto uma
// vaga é dada: dois chegando ao mesmo tempo entram um depois do outro.
const top10LockKey int64 = 0x746f7031300a // "top10"

// ClaimTop10 dá a userID a próxima vaga do Top 10 do nível 100 e devolve a
// posição. Quem já tem vaga recebe a mesma; 0 quando as vagas acabaram. A
// tabela também não aceita mais de 10 (CHECK) nem posição repetida (PK).
func (r *Repository) ClaimTop10(ctx context.Context, userID string) (int64, error) {
	var rank int64
	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, top10LockKey); err != nil {
			return err
		}
		return tx.QueryRow(
			ctx,
			`
			WITH atual AS (SELECT posicao FROM badge_top10 WHERE user_id = $1),
			nova AS (
				INSERT INTO badge_top10 (posicao, user_id)
				SELECT COUNT(*) + 1, $1 FROM badge_top10
				HAVING COUNT(*) < $2 AND NOT EXISTS (SELECT 1 FROM atual)
				RETURNING posicao
			)
			SELECT COALESCE((SELECT posicao FROM atual), (SELECT posicao FROM nova), 0)
			`,
			userID, Top10Slots,
		).Scan(&rank)
	})
	return rank, err
}
