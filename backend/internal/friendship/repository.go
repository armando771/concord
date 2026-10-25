package friendship

import (
	"context"

	"gin-quickstart/backend/internal/user"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func FriendshipRepository(db *pgxpool.Pool) *Repository {
	return &Repository{
		db: db,
	}
}

func (r *Repository) Create(ctx context.Context, requesterID string, addresseeID string) error {
	_, err := r.db.Exec(
		ctx,
		`
		INSERT INTO friendships (requester_id, addressee_id, status)
		VALUES ($1, $2, 'pending')
		`,
		requesterID,
		addresseeID,
	)
	return err
}

func (r *Repository) Find(ctx context.Context, requesterID string, addresseeID string) (*Friendship, error) {
	f := &Friendship{}
	err := r.db.QueryRow(
		ctx,
		`
		SELECT
			requester_id,
			addressee_id,
			status,
			created_at,
			updated_at
		FROM friendships
		WHERE (requester_id = $1 AND addressee_id = $2)
		   OR (requester_id = $2 AND addressee_id = $1)
		`,
		requesterID,
		addresseeID,
	).Scan(
		&f.RequesterID,
		&f.AddresseeID,
		&f.Status,
		&f.CreatedAt,
		&f.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return f, nil
}

func (r *Repository) UpdateStatus(ctx context.Context, requesterID string, addresseeID string, status string) error {
	_, err := r.db.Exec(
		ctx,
		`
		UPDATE friendships
		SET status = $3, updated_at = NOW()
		WHERE requester_id = $1 AND addressee_id = $2
		`,
		requesterID,
		addresseeID,
		status,
	)
	return err
}

func (r *Repository) Delete(ctx context.Context, requesterID string, addresseeID string) error {
	_, err := r.db.Exec(
		ctx,
		`
		DELETE FROM friendships
		WHERE (requester_id = $1 AND addressee_id = $2)
		   OR (requester_id = $2 AND addressee_id = $1)
		`,
		requesterID,
		addresseeID,
	)
	return err
}

func (r *Repository) ListFriends(ctx context.Context, userID string) ([]user.User, error) {
	rows, err := r.db.Query(
		ctx,
		`
		SELECT
			u.id,
			u.username,
			u.display_name,
			u.avatar_url,
			u.created_at,
			u.updated_at
		FROM friendships f
		JOIN users u ON (
			u.id = CASE
				WHEN f.requester_id = $1 THEN f.addressee_id
				ELSE f.requester_id
			END
		)
		WHERE (f.requester_id = $1 OR f.addressee_id = $1)
		AND f.status = 'accepted'
		ORDER BY u.username
		`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []user.User
	for rows.Next() {
		var u user.User
		if err := rows.Scan(
			&u.ID,
			&u.Username,
			&u.DisplayName,
			&u.AvatarURL,
			&u.CreatedAt,
			&u.UpdatedAt,
		); err != nil {
			return nil, err
		}
		users = append(users, u)
	}

	if users == nil {
		users = []user.User{}
	}

	return users, nil
}

func (r *Repository) ListPending(ctx context.Context, userID string) ([]PendingRequest, error) {
	rows, err := r.db.Query(
		ctx,
		`
		SELECT
			f.requester_id,
			u.username,
			u.display_name,
			u.avatar_url,
			f.created_at
		FROM friendships f
		JOIN users u ON u.id = f.requester_id
		WHERE f.addressee_id = $1
		AND f.status = 'pending'
		ORDER BY f.created_at DESC
		`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var requests []PendingRequest
	for rows.Next() {
		var r PendingRequest
		if err := rows.Scan(
			&r.UserID,
			&r.Username,
			&r.DisplayName,
			&r.AvatarURL,
			&r.CreatedAt,
		); err != nil {
			return nil, err
		}
		r.Direction = "incoming"
		requests = append(requests, r)
	}

	if requests == nil {
		requests = []PendingRequest{}
	}

	return requests, nil
}

func (r *Repository) ListSent(ctx context.Context, userID string) ([]PendingRequest, error) {
	rows, err := r.db.Query(
		ctx,
		`
		SELECT
			f.addressee_id,
			u.username,
			u.display_name,
			u.avatar_url,
			f.created_at
		FROM friendships f
		JOIN users u ON u.id = f.addressee_id
		WHERE f.requester_id = $1
		AND f.status = 'pending'
		ORDER BY f.created_at DESC
		`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var requests []PendingRequest
	for rows.Next() {
		var r PendingRequest
		if err := rows.Scan(
			&r.UserID,
			&r.Username,
			&r.DisplayName,
			&r.AvatarURL,
			&r.CreatedAt,
		); err != nil {
			return nil, err
		}
		r.Direction = "outgoing"
		requests = append(requests, r)
	}

	if requests == nil {
		requests = []PendingRequest{}
	}

	return requests, nil
}
