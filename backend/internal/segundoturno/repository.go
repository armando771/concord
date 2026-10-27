package segundoturno

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func SegundoTurnoRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// Carregar junta a data da conta e a resposta (se houver) numa query só.
func (r *Repository) Carregar(ctx context.Context, userID string) (Conta, error) {
	var c Conta
	err := r.db.QueryRow(
		ctx,
		`
		SELECT u.created_at, r.user_id IS NOT NULL, COALESCE(r.fez_o_l, FALSE)
		FROM users u
		LEFT JOIN segundo_turno_respostas r ON r.user_id = u.id
		WHERE u.id = $1
		`,
		userID,
	).Scan(&c.CriadaEm, &c.Respondeu, &c.FezOL)
	if errors.Is(err, pgx.ErrNoRows) {
		return Conta{}, ErrUsuarioNaoEncontrado
	}
	return c, err
}

// Gravar insere a resposta; ON CONFLICT garante que a primeira vence mesmo
// com dois pedidos ao mesmo tempo.
func (r *Repository) Gravar(ctx context.Context, userID string, fezOL bool) (bool, error) {
	tag, err := r.db.Exec(
		ctx,
		`INSERT INTO segundo_turno_respostas (user_id, fez_o_l) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		userID, fezOL,
	)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}
