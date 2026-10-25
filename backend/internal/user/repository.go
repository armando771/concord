package user

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func UserRepository(db *pgxpool.Pool) *Repository {
	return &Repository{
		db: db,
	}
}

// userColumns e scanUser andam juntos: a ordem das colunas é a do Scan.
const userColumns = `
	id,
	username,
	display_name,
	email,
	password_hash,
	avatar_url,
	banner_url,
	banner_color,
	pronouns,
	bio,
	status_text,
	links,
	status,
	active,
	created_at,
	updated_at
`

func scanUser(row pgx.Row) (*User, error) {
	user := &User{}
	err := row.Scan(
		&user.ID,
		&user.Username,
		&user.DisplayName,
		&user.Email,
		&user.PasswordHash,
		&user.AvatarURL,
		&user.BannerURL,
		&user.BannerColor,
		&user.Pronouns,
		&user.Bio,
		&user.StatusText,
		&user.Links,
		&user.Status,
		&user.Active,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if user.Links == nil {
		user.Links = []ProfileLink{}
	}
	return user, nil
}

func (r *Repository) FindByEmail(ctx context.Context, email string) (*User, error) {
	return scanUser(r.db.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE email = $1`, email))
}

func (r *Repository) FindByID(ctx context.Context, id string) (*User, error) {
	return scanUser(r.db.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE id = $1`, id))
}

func (r *Repository) FindByUsername(ctx context.Context, username string) (*User, error) {
	return scanUser(r.db.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE username = $1`, username))
}

func (r *Repository) SearchByUsername(ctx context.Context, query string, excludeUserID string) ([]User, error) {
	rows, err := r.db.Query(
		ctx,
		`
		SELECT
			id,
			username,
			display_name,
			email,
			avatar_url,
			created_at,
			updated_at
		FROM users
		WHERE username ILIKE '%' || $1 || '%'
		AND id <> $2
		LIMIT 20
		`,
		query,
		excludeUserID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(
			&u.ID,
			&u.Username,
			&u.DisplayName,
			&u.Email,
			&u.AvatarURL,
			&u.CreatedAt,
			&u.UpdatedAt,
		); err != nil {
			return nil, err
		}
		users = append(users, u)
	}

	if users == nil {
		users = []User{}
	}

	return users, nil
}

func (r *Repository) Create(
	ctx context.Context,
	user *User,
) error {
	return r.db.QueryRow(
		ctx,
		`
		INSERT INTO users (
			id,
			username,
			display_name,
			email,
			password_hash,
			avatar_url
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING
			pronouns,
			bio,
			status_text,
			links,
			status,
			active,
			created_at,
			updated_at
		`,
		user.ID,
		user.Username,
		user.DisplayName,
		user.Email,
		user.PasswordHash,
		user.AvatarURL,
	).Scan(
		&user.Pronouns,
		&user.Bio,
		&user.StatusText,
		&user.Links,
		&user.Status,
		&user.Active,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
}

func (r *Repository) UpdateProfile(ctx context.Context, id string, in ProfileInput) (*User, error) {
	return scanUser(r.db.QueryRow(
		ctx,
		`
		UPDATE users
		SET display_name = $2, pronouns = $3, bio = $4, status_text = $5,
			banner_color = $6, links = $7, updated_at = NOW()
		WHERE id = $1
		RETURNING `+userColumns,
		id,
		in.DisplayName,
		in.Pronouns,
		in.Bio,
		in.StatusText,
		in.BannerColor,
		in.Links,
	))
}

// SetAvatar troca a URL do avatar e devolve a anterior (para apagar o arquivo).
func (r *Repository) SetAvatar(ctx context.Context, id string, url *string) (*User, *string, error) {
	return r.swapMedia(ctx, id, "avatar_url", url)
}

// SetBanner troca a URL do banner e devolve a anterior.
func (r *Repository) SetBanner(ctx context.Context, id string, url *string) (*User, *string, error) {
	return r.swapMedia(ctx, id, "banner_url", url)
}

// swapMedia lê a URL antiga e grava a nova na mesma transação. column vem
// sempre de SetAvatar/SetBanner, nunca do cliente.
func (r *Repository) swapMedia(ctx context.Context, id, column string, url *string) (*User, *string, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback(ctx)

	var old *string
	if err := tx.QueryRow(ctx, `SELECT `+column+` FROM users WHERE id = $1 FOR UPDATE`, id).Scan(&old); err != nil {
		return nil, nil, err
	}
	user, err := scanUser(tx.QueryRow(
		ctx,
		`UPDATE users SET `+column+` = $2, updated_at = NOW() WHERE id = $1 RETURNING `+userColumns,
		id,
		url,
	))
	if err != nil {
		return nil, nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, nil, err
	}
	return user, old, nil
}

func (r *Repository) SetStatus(ctx context.Context, id string, status string) (*User, error) {
	return scanUser(r.db.QueryRow(
		ctx,
		`UPDATE users SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING `+userColumns,
		id,
		status,
	))
}

func (r *Repository) GetStatus(ctx context.Context, id string) (string, error) {
	var status string
	err := r.db.QueryRow(ctx, `SELECT status FROM users WHERE id = $1`, id).Scan(&status)
	return status, err
}
