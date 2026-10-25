package server

import (
	"context"
	"time"
)

// Ban: alguém banido do servidor (não entra de novo por convite nem código).
type Ban struct {
	ServerID    string    `json:"server_id"`
	UserID      string    `json:"user_id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name"`
	AvatarURL   *string   `json:"avatar_url,omitempty"`
	BannedBy    *string   `json:"banned_by,omitempty"`
	Reason      *string   `json:"reason,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

func (r *Repository) IsBanned(ctx context.Context, serverID, userID string) (bool, error) {
	var banned bool
	err := r.db.QueryRow(
		ctx,
		`SELECT EXISTS(SELECT 1 FROM server_bans WHERE server_id = $1 AND user_id = $2)`,
		serverID,
		userID,
	).Scan(&banned)
	return banned, err
}

// RemoveMember tira o membro (os cargos dele vão junto pelo cascade).
func (r *Repository) RemoveMember(ctx context.Context, serverID, userID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM server_members WHERE server_id = $1 AND user_id = $2`, serverID, userID)
	return err
}

// BanMember grava o banimento e tira o membro numa transação.
func (r *Repository) BanMember(ctx context.Context, serverID, userID, bannedBy string, reason *string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(
		ctx,
		`
		INSERT INTO server_bans (server_id, user_id, banned_by, reason)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (server_id, user_id) DO UPDATE SET banned_by = EXCLUDED.banned_by, reason = EXCLUDED.reason
		`,
		serverID, userID, bannedBy, reason,
	); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM server_members WHERE server_id = $1 AND user_id = $2`, serverID, userID); err != nil {
		return err
	}
	// Convite pendente para quem foi banido não vale mais.
	if _, err := tx.Exec(
		ctx,
		`UPDATE server_invites SET status = 'declined', responded_at = NOW() WHERE server_id = $1 AND invitee_id = $2 AND status = 'pending'`,
		serverID, userID,
	); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) Unban(ctx context.Context, serverID, userID string) (bool, error) {
	tag, err := r.db.Exec(ctx, `DELETE FROM server_bans WHERE server_id = $1 AND user_id = $2`, serverID, userID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (r *Repository) ListBans(ctx context.Context, serverID string) ([]Ban, error) {
	rows, err := r.db.Query(
		ctx,
		`
		SELECT b.server_id, b.user_id, u.username, u.display_name, u.avatar_url,
			b.banned_by::text, b.reason, b.created_at
		FROM server_bans b
		JOIN users u ON u.id = b.user_id
		WHERE b.server_id = $1
		ORDER BY b.created_at DESC
		`,
		serverID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	bans := []Ban{}
	for rows.Next() {
		var b Ban
		if err := rows.Scan(&b.ServerID, &b.UserID, &b.Username, &b.DisplayName, &b.AvatarURL, &b.BannedBy, &b.Reason, &b.CreatedAt); err != nil {
			return nil, err
		}
		bans = append(bans, b)
	}
	return bans, rows.Err()
}
