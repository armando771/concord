package user

import (
	"context"
	"fmt"

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

func (r *Repository) FindByEmail(ctx context.Context, email string) (*User, error) {
	user := &User{}
	err := r.db.QueryRow(
		ctx,
		`
		SELECT
			id,
			username,
			display_name,
			email,
			password_hash,
			avatar_url,
			active,
			created_at,
			updated_at
		FROM users
		WHERE email = $1
		`,
		email,
	).Scan(
		&user.ID,
		&user.Username,
		&user.DisplayName,
		&user.Email,
		&user.PasswordHash,
		&user.AvatarURL,
		&user.Active,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return user, nil
}

// Uma query fixa por coluna: nada de montar SQL com o nome da coluna.
const loginCandidatesSelect = `
		SELECT
			id,
			username,
			display_name,
			email,
			password_hash,
			avatar_url,
			active,
			created_at,
			updated_at
		FROM users
		`

var loginCandidatesQueries = map[loginColumn]string{
	loginByEmail:    loginCandidatesSelect + `WHERE lower(email) = lower($1) ORDER BY (email = $1) DESC LIMIT 2`,
	loginByUsername: loginCandidatesSelect + `WHERE lower(username) = lower($1) ORDER BY (username = $1) DESC LIMIT 2`,
}

// FindLoginCandidates traz até duas contas cuja coluna (username ou email)
// bate com value ignorando caixa, com a que bate exatamente primeiro.
// Duas linhas sem nenhuma exata = ambíguo (ver pickLoginMatch).
func (r *Repository) FindLoginCandidates(ctx context.Context, column loginColumn, value string) ([]User, error) {
	query, ok := loginCandidatesQueries[column]
	if !ok {
		return nil, fmt.Errorf("unknown login column %q", column)
	}
	rows, err := r.db.Query(ctx, query, value)
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
			&u.PasswordHash,
			&u.AvatarURL,
			&u.Active,
			&u.CreatedAt,
			&u.UpdatedAt,
		); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

// IdentityTaken diz se já existe conta com esse username ou e-mail, sem
// diferenciar caixa (usa os índices em lower() da migration 000019).
func (r *Repository) IdentityTaken(ctx context.Context, username, email string) (bool, error) {
	var taken bool
	err := r.db.QueryRow(
		ctx,
		`SELECT EXISTS(
			SELECT 1 FROM users
			WHERE lower(username) = lower($1) OR lower(email) = lower($2)
		)`,
		username,
		email,
	).Scan(&taken)
	return taken, err
}

// CountCaseConflicts conta grupos de usernames e de e-mails iguais sem
// diferenciar caixa (só os números, sem nomes).
func (r *Repository) CountCaseConflicts(ctx context.Context) (usernameGroups, emailGroups int, err error) {
	err = r.db.QueryRow(
		ctx,
		`SELECT
			(SELECT count(*) FROM (SELECT 1 FROM users GROUP BY lower(username) HAVING count(*) > 1) u),
			(SELECT count(*) FROM (SELECT 1 FROM users GROUP BY lower(email) HAVING count(*) > 1) e)`,
	).Scan(&usernameGroups, &emailGroups)
	return usernameGroups, emailGroups, err
}

func (r *Repository) FindByID(ctx context.Context, id string) (*User, error) {
	user := &User{}
	err := r.db.QueryRow(
		ctx,
		`
		SELECT
			id,
			username,
			display_name,
			email,
			password_hash,
			avatar_url,
			active,
			created_at,
			updated_at
		FROM users
		WHERE id = $1
		`,
		id,
	).Scan(
		&user.ID,
		&user.Username,
		&user.DisplayName,
		&user.Email,
		&user.PasswordHash,
		&user.AvatarURL,
		&user.Active,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *Repository) FindByUsername(ctx context.Context, username string) (*User, error) {
	user := &User{}
	err := r.db.QueryRow(
		ctx,
		`
		SELECT
			id,
			username,
			display_name,
			email,
			password_hash,
			avatar_url,
			active,
			created_at,
			updated_at
		FROM users
		WHERE username = $1
		`,
		username,
	).Scan(
		&user.ID,
		&user.Username,
		&user.DisplayName,
		&user.Email,
		&user.PasswordHash,
		&user.AvatarURL,
		&user.Active,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return user, nil
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
		&user.Active,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
}
