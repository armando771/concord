package enquete

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func EnqueteRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// Carregar junta a data da conta e as respostas já dadas.
func (r *Repository) Carregar(ctx context.Context, userID string) (Conta, error) {
	criada, err := r.criadaEm(ctx, userID)
	if err != nil {
		return Conta{}, err
	}
	respostas, err := r.respostas(ctx, userID)
	if err != nil {
		return Conta{}, err
	}
	return Conta{CriadaEm: criada, Respostas: respostas}, nil
}

func (r *Repository) criadaEm(ctx context.Context, userID string) (time.Time, error) {
	var criada time.Time
	err := r.db.QueryRow(ctx, `SELECT created_at FROM users WHERE id = $1`, userID).Scan(&criada)
	if errors.Is(err, pgx.ErrNoRows) {
		return criada, ErrUsuarioNaoEncontrado
	}
	return criada, err
}

type escolha struct{ enquete, opcao string }

// respostas são as escolhas já gravadas: enquete -> opção.
func (r *Repository) respostas(ctx context.Context, userID string) (map[string]string, error) {
	rows, err := r.db.Query(ctx, `SELECT enquete, opcao FROM escolhas WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	escolhas, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (escolha, error) {
		var e escolha
		return e, row.Scan(&e.enquete, &e.opcao)
	})
	return indexar(escolhas), err
}

func indexar(escolhas []escolha) map[string]string {
	out := make(map[string]string, len(escolhas))
	for _, e := range escolhas {
		out[e.enquete] = e.opcao
	}
	return out
}

// Gravar insere a resposta; ON CONFLICT garante que a primeira vence mesmo
// com dois pedidos ao mesmo tempo.
func (r *Repository) Gravar(ctx context.Context, userID, enquete, opcao string) (bool, error) {
	tag, err := r.db.Exec(
		ctx,
		`INSERT INTO escolhas (user_id, enquete, opcao) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
		userID, enquete, opcao,
	)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}
