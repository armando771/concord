package birthday

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func BirthdayRepository(db *pgxpool.Pool) *Repository {
	return &Repository{
		db: db,
	}
}

// target: um servidor com aniversariantes no dia.
type target struct {
	ServerID   string
	ServerName string
	OwnerID    string
	ChannelID  *string
	Usernames  []string
}

// Targets agrupa por servidor quem faz aniversário (e deixou anunciar), com
// o canal principal de cada servidor.
func (r *Repository) Targets(ctx context.Context, month int, days []int) ([]target, error) {
	rows, err := r.db.Query(
		ctx,
		`
		SELECT
			s.id,
			s.name,
			s.owner_id,
			COALESCE(
				s.primary_channel_id,
				(SELECT c.id FROM channels c WHERE c.server_id = s.id AND c.type = 'text' ORDER BY c.created_at, c.id LIMIT 1)
			),
			array_agg(u.username ORDER BY u.username)
		FROM users u
		JOIN server_members sm ON sm.user_id = u.id
		JOIN servers s ON s.id = sm.server_id
		WHERE u.active
		AND u.announce_birthday
		AND u.birthday_month = $1
		AND u.birthday_day = ANY($2::int[])
		GROUP BY s.id, s.name, s.owner_id
		ORDER BY s.name
		`,
		month,
		days,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var targets []target
	for rows.Next() {
		var t target
		if err := rows.Scan(&t.ServerID, &t.ServerName, &t.OwnerID, &t.ChannelID, &t.Usernames); err != nil {
			return nil, err
		}
		targets = append(targets, t)
	}
	return targets, rows.Err()
}

// Claim reserva o anúncio do servidor no dia; false se já foi feito (ou está
// sendo feito) — assim nada sai repetido, nem com o backend reiniciando.
func (r *Repository) Claim(ctx context.Context, serverID string, day time.Time, channelID string) (bool, error) {
	tag, err := r.db.Exec(
		ctx,
		`
		INSERT INTO birthday_announcements (server_id, day, channel_id)
		VALUES ($1, $2, $3)
		ON CONFLICT DO NOTHING
		`,
		serverID,
		day,
		channelID,
	)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

func (r *Repository) SetMessage(ctx context.Context, serverID string, day time.Time, messageID string) error {
	_, err := r.db.Exec(
		ctx,
		`UPDATE birthday_announcements SET message_id = $3 WHERE server_id = $1 AND day = $2`,
		serverID,
		day,
		messageID,
	)
	return err
}

// Release desfaz a reserva quando a mensagem não pôde ser enviada (tenta de
// novo no próximo ciclo).
func (r *Repository) Release(ctx context.Context, serverID string, day time.Time) error {
	_, err := r.db.Exec(
		ctx,
		`DELETE FROM birthday_announcements WHERE server_id = $1 AND day = $2 AND message_id IS NULL`,
		serverID,
		day,
	)
	return err
}

type person struct {
	DisplayName string
	Day         *int
	Month       *int
	Year        *int
	Announce    bool
}

func (r *Repository) person(ctx context.Context, userID string) (*person, error) {
	p := &person{}
	err := r.db.QueryRow(
		ctx,
		`SELECT display_name, birthday_day, birthday_month, birthday_year, announce_birthday FROM users WHERE id = $1`,
		userID,
	).Scan(&p.DisplayName, &p.Day, &p.Month, &p.Year, &p.Announce)
	if err != nil {
		return nil, err
	}
	return p, nil
}

// Greetings: servidores da pessoa que já mandaram a mensagem de aniversário
// no dia.
func (r *Repository) Greetings(ctx context.Context, userID string, day time.Time) ([]Greeting, error) {
	rows, err := r.db.Query(
		ctx,
		`
		SELECT s.id, s.name, ba.channel_id
		FROM birthday_announcements ba
		JOIN servers s ON s.id = ba.server_id
		JOIN server_members sm ON sm.server_id = s.id AND sm.user_id = $1
		WHERE ba.day = $2
		AND ba.message_id IS NOT NULL
		AND ba.channel_id IS NOT NULL
		ORDER BY s.name
		`,
		userID,
		day,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	greetings := []Greeting{}
	for rows.Next() {
		var g Greeting
		if err := rows.Scan(&g.ServerID, &g.ServerName, &g.ChannelID); err != nil {
			return nil, err
		}
		greetings = append(greetings, g)
	}
	return greetings, rows.Err()
}
