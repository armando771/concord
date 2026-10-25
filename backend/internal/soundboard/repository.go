package soundboard

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, s *Sound) error {
	return r.db.QueryRow(
		ctx,
		`
		WITH inserted AS (
			INSERT INTO soundboard_sounds
				(id, server_id, uploader_id, name, emoji, content_type, size_bytes, duration_ms)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING id, server_id, uploader_id, name, emoji, content_type, size_bytes, duration_ms, created_at
		)
		SELECT
			i.created_at,
			COALESCE(u.display_name, u.username, '')
		FROM inserted i
		LEFT JOIN users u ON u.id = i.uploader_id
		`,
		s.ID,
		s.ServerID,
		s.UploaderID,
		s.Name,
		s.Emoji,
		s.ContentType,
		s.SizeBytes,
		s.DurationMs,
	).Scan(&s.CreatedAt, &s.UploaderName)
}

func (r *Repository) ListByServer(ctx context.Context, serverID string) ([]Sound, error) {
	if _, err := uuid.Parse(serverID); err != nil {
		return []Sound{}, nil
	}
	rows, err := r.db.Query(
		ctx,
		`
		SELECT
			s.id,
			s.server_id,
			s.uploader_id,
			COALESCE(u.display_name, u.username, ''),
			s.name,
			s.emoji,
			s.content_type,
			s.size_bytes,
			s.duration_ms,
			s.created_at
		FROM soundboard_sounds s
		LEFT JOIN users u ON u.id = s.uploader_id
		WHERE s.server_id = $1
		ORDER BY s.created_at DESC
		`,
		serverID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sounds := make([]Sound, 0)
	for rows.Next() {
		var s Sound
		if err := rows.Scan(
			&s.ID,
			&s.ServerID,
			&s.UploaderID,
			&s.UploaderName,
			&s.Name,
			&s.Emoji,
			&s.ContentType,
			&s.SizeBytes,
			&s.DurationMs,
			&s.CreatedAt,
		); err != nil {
			return nil, err
		}
		sounds = append(sounds, s)
	}
	return sounds, rows.Err()
}

func (r *Repository) FindByID(ctx context.Context, id string) (*Sound, error) {
	if _, err := uuid.Parse(id); err != nil {
		return nil, ErrSoundNotFound
	}
	var s Sound
	err := r.db.QueryRow(
		ctx,
		`
		SELECT
			s.id,
			s.server_id,
			s.uploader_id,
			COALESCE(u.display_name, u.username, ''),
			s.name,
			s.emoji,
			s.content_type,
			s.size_bytes,
			s.duration_ms,
			s.created_at
		FROM soundboard_sounds s
		LEFT JOIN users u ON u.id = s.uploader_id
		WHERE s.id = $1
		`,
		id,
	).Scan(
		&s.ID,
		&s.ServerID,
		&s.UploaderID,
		&s.UploaderName,
		&s.Name,
		&s.Emoji,
		&s.ContentType,
		&s.SizeBytes,
		&s.DurationMs,
		&s.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrSoundNotFound
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) CountByServer(ctx context.Context, serverID string) (int, error) {
	var count int
	err := r.db.QueryRow(
		ctx,
		`SELECT COUNT(*) FROM soundboard_sounds WHERE server_id = $1`,
		serverID,
	).Scan(&count)
	return count, err
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM soundboard_sounds WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrSoundNotFound
	}
	return nil
}
