package guest

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// notFound traduz "nenhuma linha" no erro do domínio.
func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

const inviteColumns = `id, server_id, channel_id, created_by, permissions, expires_at, revoked_at, created_at`

// passSelect: o acesso com o servidor, as permissões e o prazo do convite.
const passSelect = `
	SELECT p.id, p.invite_id, p.user_id, i.server_id, p.channel_id, i.permissions, i.expires_at, p.ended_at
	FROM call_guest_passes p
	JOIN call_guest_invites i ON i.id = p.invite_id`

func (r *Repository) CreateInvite(ctx context.Context, inv *Invite, tokenHash string) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO call_guest_invites (id, token_hash, server_id, channel_id, created_by, permissions, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		inv.ID, tokenHash, inv.ServerID, inv.ChannelID, inv.CreatedBy, inv.Permissions, inv.ExpiresAt, inv.CreatedAt)
	return err
}

func (r *Repository) queryInvite(ctx context.Context, where string, arg string) (*Invite, error) {
	rows, err := r.db.Query(ctx, `SELECT `+inviteColumns+` FROM call_guest_invites WHERE `+where, arg)
	if err != nil {
		return nil, err
	}
	inv, err := pgx.CollectExactlyOneRow(rows, pgx.RowToAddrOfStructByPos[Invite])
	return inv, notFound(err)
}

func (r *Repository) InviteByHash(ctx context.Context, tokenHash string) (*Invite, error) {
	return r.queryInvite(ctx, `token_hash = $1`, tokenHash)
}

func (r *Repository) InviteByID(ctx context.Context, id string) (*Invite, error) {
	return r.queryInvite(ctx, `id = $1`, id)
}

func (r *Repository) InvitesOfChannel(ctx context.Context, channelID string, now time.Time) ([]Invite, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+inviteColumns+` FROM call_guest_invites
		WHERE channel_id = $1 AND revoked_at IS NULL AND expires_at > $2
		ORDER BY created_at DESC`, channelID, now)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[Invite])
}

func (r *Repository) GuestsOf(ctx context.Context, inviteIDs []string) ([]InviteGuest, error) {
	rows, err := r.db.Query(ctx, `
		SELECT p.invite_id, p.user_id, u.display_name, u.avatar_url, p.ended_at
		FROM call_guest_passes p
		JOIN users u ON u.id = p.user_id
		WHERE p.invite_id = ANY($1::uuid[])
		ORDER BY p.created_at`, inviteIDs)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[InviteGuest])
}

func (r *Repository) RevokeInvite(ctx context.Context, id string, now time.Time) error {
	_, err := r.db.Exec(ctx, `UPDATE call_guest_invites SET revoked_at = $2 WHERE id = $1 AND revoked_at IS NULL`, id, now)
	return err
}

// CreateGuestUser grava o usuário efêmero: senha que nenhum login aceita e
// marcado como visitante (fora da busca e dos pedidos de amizade).
func (r *Repository) CreateGuestUser(ctx context.Context, u GuestUser) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO users (id, username, display_name, email, password_hash, is_guest)
		VALUES ($1, $2, $3, $4, '!', TRUE)`,
		u.ID, u.Username, u.DisplayName, u.Email)
	return err
}

func (r *Repository) CreatePass(ctx context.Context, p *Pass) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO call_guest_passes (id, invite_id, user_id, channel_id) VALUES ($1, $2, $3, $4)`,
		p.ID, p.InviteID, p.UserID, p.ChannelID)
	return err
}

func (r *Repository) PassFor(ctx context.Context, inviteID, userID string) (*Pass, error) {
	rows, err := r.db.Query(ctx, passSelect+` WHERE p.invite_id = $1 AND p.user_id = $2`, inviteID, userID)
	if err != nil {
		return nil, err
	}
	p, err := pgx.CollectExactlyOneRow(rows, pgx.RowToAddrOfStructByPos[Pass])
	return p, notFound(err)
}

func (r *Repository) CountPasses(ctx context.Context, inviteID string) (int, error) {
	var n int
	err := r.db.QueryRow(ctx, `SELECT count(*) FROM call_guest_passes WHERE invite_id = $1`, inviteID).Scan(&n)
	return n, err
}

func (r *Repository) MovePass(ctx context.Context, passID, channelID string) error {
	_, err := r.db.Exec(ctx, `UPDATE call_guest_passes SET channel_id = $2 WHERE id = $1`, passID, channelID)
	return err
}

func (r *Repository) EndPass(ctx context.Context, passID string, now time.Time) error {
	_, err := r.db.Exec(ctx, `UPDATE call_guest_passes SET ended_at = $2 WHERE id = $1 AND ended_at IS NULL`, passID, now)
	return err
}

func (r *Repository) ActivePasses(ctx context.Context, now time.Time) ([]Pass, error) {
	rows, err := r.db.Query(ctx, passSelect+`
		WHERE p.ended_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > $1`, now)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[Pass])
}

// DeleteStaleGuests apaga os usuários de visitante sem acesso ativo desde
// antes de `before` (e que não estão em call nem abriram uma que segue ativa:
// apagar o usuário apagaria a chamada em cascata), e os convites vencidos há
// mais de um dia.
func (r *Repository) DeleteStaleGuests(ctx context.Context, before time.Time) (int64, error) {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM users u
		WHERE u.is_guest AND u.created_at < $1
		AND NOT EXISTS (
			SELECT 1 FROM call_guest_passes p JOIN call_guest_invites i ON i.id = p.invite_id
			WHERE p.user_id = u.id AND p.ended_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > $1)
		AND NOT EXISTS (SELECT 1 FROM calls c WHERE c.initiator_id = u.id AND c.status <> 'ended')
		AND NOT EXISTS (SELECT 1 FROM call_participants cp WHERE cp.user_id = u.id AND cp.left_at IS NULL)`, before)
	if err != nil {
		return 0, err
	}
	_, err = r.db.Exec(ctx, `DELETE FROM call_guest_invites WHERE expires_at < $1`, before.Add(-24*time.Hour))
	return tag.RowsAffected(), err
}
