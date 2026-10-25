package channel

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func ChannelRepository(db *pgxpool.Pool) *Repository {
	return &Repository{
		db: db,
	}
}

func (r *Repository) Create(ctx context.Context, ch *Channel) error {
	return r.db.QueryRow(
		ctx,
		`
		INSERT INTO channels (id, server_id, name, type, position, created_by)
		VALUES (
			$1,
			$2,
			$3,
			$4,
			COALESCE((SELECT MAX(position) + 1 FROM channels WHERE server_id = $2 AND type = $4), 0),
			$5
		)
		RETURNING
			id,
			server_id,
			name,
			type,
			position,
			created_by,
			created_at,
			updated_at
		`,
		ch.ID,
		ch.ServerID,
		ch.Name,
		ch.Type,
		ch.CreatedBy,
	).Scan(
		&ch.ID,
		&ch.ServerID,
		&ch.Name,
		&ch.Type,
		&ch.Position,
		&ch.CreatedBy,
		&ch.CreatedAt,
		&ch.UpdatedAt,
	)
}

func (r *Repository) FindByID(ctx context.Context, id string) (*Channel, error) {
	ch := &Channel{}
	err := r.db.QueryRow(
		ctx,
		`
		SELECT
			id,
			server_id,
			name,
			type,
			position,
			created_by,
			created_at,
			updated_at
		FROM channels
		WHERE id = $1
		`,
		id,
	).Scan(
		&ch.ID,
		&ch.ServerID,
		&ch.Name,
		&ch.Type,
		&ch.Position,
		&ch.CreatedBy,
		&ch.CreatedAt,
		&ch.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return ch, nil
}

func (r *Repository) ChannelServerID(ctx context.Context, channelID string) (string, error) {
	var serverID string
	err := r.db.QueryRow(ctx, `SELECT server_id FROM channels WHERE id = $1`, channelID).Scan(&serverID)
	if err != nil {
		return "", err
	}
	return serverID, nil
}

func (r *Repository) Update(ctx context.Context, id string, name string) error {
	tag, err := r.db.Exec(
		ctx,
		`UPDATE channels SET name = $1, updated_at = NOW() WHERE id = $2`,
		name,
		id,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrChannelNotFound
	}
	return nil
}

func (r *Repository) Reorder(ctx context.Context, serverID string, channelIDs []string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for i, channelID := range channelIDs {
		tag, err := tx.Exec(
			ctx,
			`UPDATE channels SET position = $1, updated_at = NOW() WHERE id = $2 AND server_id = $3`,
			i,
			channelID,
			serverID,
		)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return ErrChannelNotFound
		}
	}

	return tx.Commit(ctx)
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM channels WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrChannelNotFound
	}
	return nil
}

func (r *Repository) ListByServerID(ctx context.Context, serverID string) ([]Channel, error) {
	rows, err := r.db.Query(
		ctx,
		`
		SELECT
			id,
			server_id,
			name,
			type,
			position,
			created_by,
			created_at,
			updated_at
		FROM channels
		WHERE server_id = $1
		ORDER BY position, created_at, name
		`,
		serverID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var channels []Channel
	for rows.Next() {
		var ch Channel
		if err := rows.Scan(
			&ch.ID,
			&ch.ServerID,
			&ch.Name,
			&ch.Type,
			&ch.Position,
			&ch.CreatedBy,
			&ch.CreatedAt,
			&ch.UpdatedAt,
		); err != nil {
			return nil, err
		}
		channels = append(channels, ch)
	}

	if channels == nil {
		channels = []Channel{}
	}

	return channels, nil
}

func (r *Repository) IsMember(ctx context.Context, serverID string, userID string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(
		ctx,
		`SELECT EXISTS(SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2)`,
		serverID,
		userID,
	).Scan(&exists)
	return exists, err
}

func (r *Repository) IsAdminOrOwner(ctx context.Context, serverID string, userID string) (bool, error) {
	var allowed bool
	err := r.db.QueryRow(
		ctx,
		`
		SELECT EXISTS(
			SELECT 1 FROM servers WHERE id = $1 AND owner_id = $2
			UNION ALL
			SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2 AND role = 'admin'
		)
		`,
		serverID,
		userID,
	).Scan(&allowed)
	return allowed, err
}
