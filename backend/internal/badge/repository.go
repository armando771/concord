package badge

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrUserNotFound = errors.New("user not found")

type Repository struct {
	db *pgxpool.Pool
}

func BadgeRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// Stats junta os números da pessoa numa query só: contadores prontos, um
// COUNT de servidores pelo índice de owner_id, um COUNT dos cards de propostas
// pelo índice de author_id (Contribuinte) e se ela está em dev_badge_users
// (Fundador).
func (r *Repository) Stats(ctx context.Context, userID string) (Stats, error) {
	var s Stats
	err := r.db.QueryRow(
		ctx,
		`
		SELECT
			u.created_at,
			COALESCE(l.xp, 0),
			COALESCE(l.voice_seconds, 0),
			COALESCE(b.messages_sent, 0),
			COALESCE(b.reactions_given, 0),
			COALESCE(b.stream_seconds, 0),
			COALESCE(b.night_seconds, 0),
			COALESCE(b.morning_seconds, 0),
			COALESCE(b.peak_call_size, 0),
			COALESCE(b.longest_session_seconds, 0),
			(SELECT COUNT(*) FROM servers sv WHERE sv.owner_id = u.id),
			(SELECT COUNT(*) FROM proposals p WHERE p.author_id = u.id),
			EXISTS (SELECT 1 FROM dev_badge_users d WHERE d.user_id = u.id),
			EXISTS (SELECT 1 FROM segundo_turno_respostas r WHERE r.user_id = u.id AND r.fez_o_l)
		FROM users u
		LEFT JOIN user_levels l ON l.user_id = u.id
		LEFT JOIN user_badge_stats b ON b.user_id = u.id
		WHERE u.id = $1
		`,
		userID,
	).Scan(
		&s.CreatedAt,
		&s.XP,
		&s.VoiceSeconds,
		&s.MessagesSent,
		&s.Reactions,
		&s.StreamSeconds,
		&s.NightSeconds,
		&s.MorningSeconds,
		&s.PeakCallSize,
		&s.LongestSessionSeconds,
		&s.OwnedServers,
		&s.Proposals,
		&s.IsDev,
		&s.FezOL,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Stats{}, ErrUserNotFound
	}
	return s, err
}

// Unlocks devolve os tiers já gravados da pessoa.
func (r *Repository) Unlocks(ctx context.Context, userID string) (Unlocks, error) {
	rows, err := r.db.Query(ctx, `SELECT category, tier, unlocked_at FROM user_badges WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := Unlocks{}
	for rows.Next() {
		var u Unlock
		if err := rows.Scan(&u.Category, &u.Tier, &u.At); err != nil {
			return nil, err
		}
		if out[u.Category] == nil {
			out[u.Category] = map[int]time.Time{}
		}
		out[u.Category][u.Tier] = u.At
	}
	return out, rows.Err()
}

// SaveUnlocks grava os tiers novos e devolve só os que entraram agora (outro
// pedido pode ter gravado o mesmo tier ao mesmo tempo).
func (r *Repository) SaveUnlocks(ctx context.Context, userID string, unlocks []Unlock) ([]Unlock, error) {
	if len(unlocks) == 0 {
		return nil, nil
	}
	categories := make([]string, len(unlocks))
	tiers := make([]int32, len(unlocks))
	times := make([]time.Time, len(unlocks))
	for i, u := range unlocks {
		categories[i], tiers[i], times[i] = u.Category, int32(u.Tier), u.At
	}
	rows, err := r.db.Query(
		ctx,
		`
		INSERT INTO user_badges (user_id, category, tier, unlocked_at)
		SELECT $1, c, t, at FROM unnest($2::text[], $3::int[], $4::timestamptz[]) AS x(c, t, at)
		ON CONFLICT DO NOTHING
		RETURNING category, tier, unlocked_at
		`,
		userID, categories, tiers, times,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var saved []Unlock
	for rows.Next() {
		var u Unlock
		if err := rows.Scan(&u.Category, &u.Tier, &u.At); err != nil {
			return nil, err
		}
		saved = append(saved, u)
	}
	return saved, rows.Err()
}

// AddCallStats soma o que o tracker juntou (tempos) e guarda o maior valor
// (tamanho da call e sessão seguida).
func (r *Repository) AddCallStats(ctx context.Context, userID string, d Delta) error {
	_, err := r.db.Exec(
		ctx,
		`
		INSERT INTO user_badge_stats (user_id, stream_seconds, night_seconds, morning_seconds, peak_call_size, longest_session_seconds)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id) DO UPDATE SET
			stream_seconds = user_badge_stats.stream_seconds + EXCLUDED.stream_seconds,
			night_seconds = user_badge_stats.night_seconds + EXCLUDED.night_seconds,
			morning_seconds = user_badge_stats.morning_seconds + EXCLUDED.morning_seconds,
			peak_call_size = GREATEST(user_badge_stats.peak_call_size, EXCLUDED.peak_call_size),
			longest_session_seconds = GREATEST(user_badge_stats.longest_session_seconds, EXCLUDED.longest_session_seconds),
			updated_at = NOW()
		`,
		userID, d.Stream, d.Night, d.Morning, d.PeakCallSize, d.LongestSession,
	)
	return err
}

// SaveSessions grava, no desligamento, as sessões de maratona em andamento
// (segundos seguidos em call) para o processo novo continuar a contagem.
func (r *Repository) SaveSessions(ctx context.Context, sessions map[string]int64) error {
	if len(sessions) == 0 {
		return nil
	}
	ids := make([]string, 0, len(sessions))
	secs := make([]int64, 0, len(sessions))
	for id, s := range sessions {
		ids = append(ids, id)
		secs = append(secs, s)
	}
	_, err := r.db.Exec(
		ctx,
		`
		INSERT INTO user_badge_stats (user_id, session_seconds, session_saved_at)
		SELECT id, s, NOW() FROM unnest($1::uuid[], $2::bigint[]) AS x(id, s)
		ON CONFLICT (user_id) DO UPDATE SET
			session_seconds = EXCLUDED.session_seconds,
			session_saved_at = EXCLUDED.session_saved_at
		`,
		ids, secs,
	)
	return err
}

// LoadSessions lê as sessões gravadas há menos de maxAge (o deploy acabou de
// reiniciar) e as consome: um reinício depois não as reaproveita de novo.
func (r *Repository) LoadSessions(ctx context.Context, maxAge time.Duration) (map[string]int64, error) {
	rows, err := r.db.Query(
		ctx,
		`
		UPDATE user_badge_stats SET session_seconds = 0, session_saved_at = NULL
		FROM (
			SELECT user_id, session_seconds AS s, session_saved_at AS at
			FROM user_badge_stats WHERE session_saved_at IS NOT NULL FOR UPDATE
		) old
		WHERE user_badge_stats.user_id = old.user_id
		RETURNING old.user_id, old.s, old.at > NOW() - make_interval(secs => $1)
		`,
		maxAge.Seconds(),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int64{}
	for rows.Next() {
		var id string
		var s int64
		var fresh bool
		if err := rows.Scan(&id, &s, &fresh); err != nil {
			return nil, err
		}
		if fresh && s > 0 {
			out[id] = s
		}
	}
	return out, rows.Err()
}
