package level

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func LevelRepository(db *pgxpool.Pool) *Repository {
	return &Repository{
		db: db,
	}
}

// AddVoiceXP soma XP e tempo de voz e devolve os totais atualizados.
func (r *Repository) AddVoiceXP(ctx context.Context, userID string, xp int64, seconds int64) (int64, int64, error) {
	var totalXP, totalSeconds int64
	err := r.db.QueryRow(
		ctx,
		`
		INSERT INTO user_levels (user_id, xp, voice_seconds)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id) DO UPDATE SET
			xp = user_levels.xp + EXCLUDED.xp,
			voice_seconds = user_levels.voice_seconds + EXCLUDED.voice_seconds,
			updated_at = NOW()
		RETURNING xp, voice_seconds
		`,
		userID,
		xp,
		seconds,
	).Scan(&totalXP, &totalSeconds)
	return totalXP, totalSeconds, err
}

// FindByUserIDs devolve o progresso de cada usuário; quem nunca ganhou XP fica
// no nível 1.
func (r *Repository) FindByUserIDs(ctx context.Context, userIDs []string) (map[string]Progress, error) {
	result := make(map[string]Progress, len(userIDs))
	for _, id := range userIDs {
		result[id] = newProgress(id, 0, 0)
	}

	rows, err := r.db.Query(
		ctx,
		`
		SELECT user_id, xp, voice_seconds
		FROM user_levels
		WHERE user_id = ANY($1::uuid[])
		`,
		userIDs,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id string
		var xp, seconds int64
		if err := rows.Scan(&id, &xp, &seconds); err != nil {
			return nil, err
		}
		result[id] = newProgress(id, xp, seconds)
	}
	return result, rows.Err()
}
