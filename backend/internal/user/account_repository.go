package user

import (
	"context"
	"time"
)

// UsernameTakenByOther diz se outra conta (não a própria) já usa o username,
// sem diferenciar caixa (índice em lower(username) da migration 000025).
func (r *Repository) UsernameTakenByOther(ctx context.Context, id, username string) (bool, error) {
	var taken bool
	err := r.db.QueryRow(
		ctx,
		`SELECT EXISTS(SELECT 1 FROM users WHERE lower(username) = lower($2) AND id <> $1)`,
		id, username,
	).Scan(&taken)
	return taken, err
}

// EmailTakenByOther diz se outra conta (não a própria) já usa o e-mail, sem
// diferenciar caixa.
func (r *Repository) EmailTakenByOther(ctx context.Context, id, email string) (bool, error) {
	var taken bool
	err := r.db.QueryRow(
		ctx,
		`SELECT EXISTS(SELECT 1 FROM users WHERE lower(email) = lower($2) AND id <> $1)`,
		id, email,
	).Scan(&taken)
	return taken, err
}

// SetUsername troca o @ e marca a data da troca. Só a caixa não conta (nem
// marca a data). Se a última troca foi depois de cutoff, não muda nada e
// devolve pgx.ErrNoRows: o WHERE fecha a corrida entre dois pedidos.
func (r *Repository) SetUsername(ctx context.Context, id, username string, cutoff time.Time) (*User, error) {
	return scanUser(r.db.QueryRow(
		ctx,
		`UPDATE users
		SET username = $2,
			username_changed_at = CASE WHEN lower(username) = lower($2) THEN username_changed_at ELSE NOW() END,
			updated_at = NOW()
		WHERE id = $1
			AND (lower(username) = lower($2) OR username_changed_at IS NULL OR username_changed_at <= $3)
		RETURNING `+userColumns,
		id, username, cutoff,
	))
}

// SetEmail troca o e-mail; sem keepVerified, a conta volta a "não confirmado".
func (r *Repository) SetEmail(ctx context.Context, id, email string, keepVerified bool) (*User, error) {
	return scanUser(r.db.QueryRow(
		ctx,
		`UPDATE users
		SET email = $2,
			email_verified_at = CASE WHEN $3 THEN email_verified_at ELSE NULL END,
			updated_at = NOW()
		WHERE id = $1
		RETURNING `+userColumns,
		id, email, keepVerified,
	))
}
