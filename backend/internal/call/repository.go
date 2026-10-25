package call

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func CallRepository(db *pgxpool.Pool) *Repository {
	return &Repository{
		db: db,
	}
}

func (r *Repository) Create(ctx context.Context, call *Call) error {
	return r.db.QueryRow(
		ctx,
		`
		INSERT INTO calls (
			id,
			type,
			conversation_id,
			channel_id,
			server_id,
			initiator_id,
			status
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING
			started_at
		`,
		call.ID,
		call.Type,
		call.ConversationID,
		call.ChannelID,
		call.ServerID,
		call.InitiatorID,
		call.Status,
	).Scan(&call.StartedAt)
}

func (r *Repository) AddParticipant(ctx context.Context, participant *CallParticipant) error {
	return r.db.QueryRow(
		ctx,
		`
		INSERT INTO call_participants (call_id, user_id, role)
		VALUES ($1, $2, $3)
		-- Voltou para a mesma chamada (canal): a linha antiga tem left_at e
		-- o reinício do backend não o recolocaria na chamada.
		ON CONFLICT (call_id, user_id) DO UPDATE
		SET role = EXCLUDED.role, joined_at = NOW(), left_at = NULL,
			muted = false, deafened = false, screen_sharing = false
		RETURNING joined_at
		`,
		participant.CallID,
		participant.UserID,
		participant.Role,
	).Scan(&participant.JoinedAt)
}

func (r *Repository) MarkParticipantLeft(ctx context.Context, callID string, userID string) error {
	_, err := r.db.Exec(
		ctx,
		`
		UPDATE call_participants
		SET left_at = NOW()
		WHERE call_id = $1 AND user_id = $2 AND left_at IS NULL
		`,
		callID,
		userID,
	)
	return err
}

// MarkCallActive grava que a chamada foi atendida (só sai de "ringing").
func (r *Repository) MarkCallActive(ctx context.Context, callID string) error {
	_, err := r.db.Exec(
		ctx,
		`UPDATE calls SET status = 'active' WHERE id = $1 AND status = 'ringing'`,
		callID,
	)
	return err
}

// SaveVoiceState guarda o mudo/ensurdecido de quem está na chamada.
func (r *Repository) SaveVoiceState(ctx context.Context, callID string, userID string, muted bool, deafened bool) error {
	_, err := r.db.Exec(
		ctx,
		`
		UPDATE call_participants
		SET muted = $3, deafened = $4
		WHERE call_id = $1 AND user_id = $2 AND left_at IS NULL
		`,
		callID,
		userID,
		muted,
		deafened,
	)
	return err
}

// SaveScreenSharing guarda se quem está na chamada está transmitindo a tela.
func (r *Repository) SaveScreenSharing(ctx context.Context, callID string, userID string, active bool) error {
	_, err := r.db.Exec(
		ctx,
		`
		UPDATE call_participants
		SET screen_sharing = $3
		WHERE call_id = $1 AND user_id = $2 AND left_at IS NULL
		`,
		callID,
		userID,
		active,
	)
	return err
}

func (r *Repository) EndCall(ctx context.Context, id string) error {
	_, err := r.db.Exec(
		ctx,
		`
		UPDATE calls
		SET status = 'ended', ended_at = NOW()
		WHERE id = $1 AND status <> 'ended'
		`,
		id,
	)
	return err
}

func (r *Repository) FindByID(ctx context.Context, id string) (*Call, error) {
	c := &Call{}
	err := r.db.QueryRow(
		ctx,
		`
		SELECT
			id,
			type,
			conversation_id,
			channel_id,
			server_id,
			initiator_id,
			status,
			started_at,
			ended_at
		FROM calls
		WHERE id = $1
		`,
		id,
	).Scan(
		&c.ID,
		&c.Type,
		&c.ConversationID,
		&c.ChannelID,
		&c.ServerID,
		&c.InitiatorID,
		&c.Status,
		&c.StartedAt,
		&c.EndedAt,
	)
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (r *Repository) ListParticipants(ctx context.Context, callID string) ([]CallParticipant, error) {
	rows, err := r.db.Query(
		ctx,
		`
		SELECT
			call_id,
			user_id,
			role,
			joined_at,
			left_at,
			muted,
			deafened,
			screen_sharing
		FROM call_participants
		WHERE call_id = $1
		ORDER BY joined_at
		`,
		callID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var participants []CallParticipant
	for rows.Next() {
		var p CallParticipant
		if err := rows.Scan(
			&p.CallID,
			&p.UserID,
			&p.Role,
			&p.JoinedAt,
			&p.LeftAt,
			&p.Muted,
			&p.Deafened,
			&p.ScreenSharing,
		); err != nil {
			return nil, err
		}
		participants = append(participants, p)
	}

	if participants == nil {
		participants = []CallParticipant{}
	}

	return participants, nil
}

// ListUnended devolve as chamadas ainda não encerradas (para restaurar o
// estado em memória quando o servidor reinicia).
func (r *Repository) ListUnended(ctx context.Context) ([]*Call, error) {
	rows, err := r.db.Query(
		ctx,
		`
		SELECT id, type, conversation_id, channel_id, server_id, initiator_id, status, started_at, ended_at
		FROM calls
		WHERE status <> 'ended'
		`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var calls []*Call
	for rows.Next() {
		c := &Call{}
		if err := rows.Scan(
			&c.ID, &c.Type, &c.ConversationID, &c.ChannelID, &c.ServerID,
			&c.InitiatorID, &c.Status, &c.StartedAt, &c.EndedAt,
		); err != nil {
			return nil, err
		}
		calls = append(calls, c)
	}
	return calls, rows.Err()
}
