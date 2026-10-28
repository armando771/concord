package soundboard

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ListFavorites: os favoritos do usuário, de qualquer servidor, com o nome do
// servidor de origem; o mais novo primeiro.
func (r *Repository) ListFavorites(ctx context.Context, userID string) ([]FavoriteSound, error) {
	rows, err := r.db.Query(
		ctx,
		`SELECT `+soundColumns+`, COALESCE(sv.name, '')
		FROM soundboard_favorites f
		JOIN soundboard_sounds s ON s.id = f.sound_id
		LEFT JOIN users u ON u.id = s.uploader_id
		LEFT JOIN servers sv ON sv.id = s.server_id
		WHERE f.user_id = $1
		ORDER BY f.created_at DESC, s.id`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (FavoriteSound, error) {
		var f FavoriteSound
		err := row.Scan(append(soundFields(&f.Sound), &f.ServerName)...)
		return f, err
	})
}

// AddFavorite favorita o som (já favoritado não é erro). Com max favoritos o
// próximo dá ErrFavoritesFull.
func (r *Repository) AddFavorite(ctx context.Context, userID, soundID string, max int) error {
	var ok bool
	err := r.db.QueryRow(
		ctx,
		`WITH ins AS (
			INSERT INTO soundboard_favorites (user_id, sound_id)
			SELECT $1, $2
			WHERE (SELECT COUNT(*) FROM soundboard_favorites WHERE user_id = $1) < $3
			ON CONFLICT DO NOTHING
			RETURNING 1
		)
		SELECT EXISTS (SELECT 1 FROM ins)
			OR EXISTS (SELECT 1 FROM soundboard_favorites WHERE user_id = $1 AND sound_id = $2)`,
		userID, soundID, max,
	).Scan(&ok)
	if err == nil && !ok {
		return ErrFavoritesFull
	}
	return err
}

// RemoveFavorite tira o som dos favoritos (o que não estava não é erro).
func (r *Repository) RemoveFavorite(ctx context.Context, userID, soundID string) error {
	if _, err := uuid.Parse(soundID); err != nil {
		return nil
	}
	_, err := r.db.Exec(ctx, `DELETE FROM soundboard_favorites WHERE user_id = $1 AND sound_id = $2`, userID, soundID)
	return err
}

// IsFavorite: o usuário favoritou o som.
func (r *Repository) IsFavorite(ctx context.Context, userID, soundID string) (bool, error) {
	if _, err := uuid.Parse(soundID); err != nil {
		return false, nil
	}
	var ok bool
	err := r.db.QueryRow(
		ctx,
		`SELECT EXISTS (SELECT 1 FROM soundboard_favorites WHERE user_id = $1 AND sound_id = $2)`,
		userID, soundID,
	).Scan(&ok)
	return ok, err
}
