package auth

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func AuthRepository(db *pgxpool.Pool) *Repository {
	return &Repository{
		db: db,
	}
}

func (r *Repository) SaveRefreshToken(ctx context.Context, id string, token string, userID string, expiresAt interface{}) error {
	_, err := r.db.Exec(
		ctx,
		`
		INSERT INTO refresh_tokens (id, token, user_id, expires_at)
		VALUES ($1, $2, $3, $4)
		`,
		id,
		token,
		userID,
		expiresAt,
	)
	return err
}

func (r *Repository) FindRefreshToken(ctx context.Context, token string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(
		ctx,
		`SELECT EXISTS(SELECT 1 FROM refresh_tokens WHERE token = $1)`,
		token,
	).Scan(&exists)
	return exists, err
}

func (r *Repository) DeleteRefreshToken(ctx context.Context, token string) error {
	_, err := r.db.Exec(
		ctx,
		`DELETE FROM refresh_tokens WHERE token = $1`,
		token,
	)
	return err
}

func (r *Repository) DeleteAllUserRefreshTokens(ctx context.Context, userID string) error {
	_, err := r.db.Exec(
		ctx,
		`DELETE FROM refresh_tokens WHERE user_id = $1`,
		userID,
	)
	return err
}

// CreateEmailToken grava o hash de um token novo e invalida os pendentes da
// mesma finalidade (só o último e-mail enviado vale).
func (r *Repository) CreateEmailToken(ctx context.Context, userID, purpose, tokenHash string, expiresAt time.Time) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(
		ctx,
		`UPDATE email_tokens SET used_at = NOW() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`,
		userID, purpose,
	); err != nil {
		return err
	}
	if _, err := tx.Exec(
		ctx,
		`INSERT INTO email_tokens (id, user_id, purpose, token_hash, expires_at) VALUES ($1, $2, $3, $4, $5)`,
		uuid.New().String(), userID, purpose, tokenHash, expiresAt,
	); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ConsumeEmailToken usa o token de uma vez só (UPDATE atômico): dois pedidos
// com o mesmo link não passam os dois.
func (r *Repository) ConsumeEmailToken(ctx context.Context, purpose, tokenHash string) (string, error) {
	var userID string
	err := r.db.QueryRow(
		ctx,
		`UPDATE email_tokens SET used_at = NOW()
		WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > NOW()
		RETURNING user_id`,
		tokenHash, purpose,
	).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrInvalidEmailToken
	}
	return userID, err
}
