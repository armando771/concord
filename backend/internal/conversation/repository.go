package conversation

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func ConversationRepository(db *pgxpool.Pool) *Repository {
	return &Repository{
		db: db,
	}
}

func (r *Repository) Create(ctx context.Context, conv *Conversation) error {
	return r.db.QueryRow(
		ctx,
		`
		INSERT INTO conversations (id, user_a_id, user_b_id)
		VALUES ($1, $2, $3)
		RETURNING
			id,
			user_a_id,
			user_b_id,
			created_at,
			updated_at
		`,
		conv.ID,
		conv.UserAID,
		conv.UserBID,
	).Scan(
		&conv.ID,
		&conv.UserAID,
		&conv.UserBID,
		&conv.CreatedAt,
		&conv.UpdatedAt,
	)
}

func (r *Repository) FindByPair(ctx context.Context, userAID string, userBID string) (*Conversation, error) {
	conv := &Conversation{}
	err := r.db.QueryRow(
		ctx,
		`
		SELECT
			id,
			user_a_id,
			user_b_id,
			created_at,
			updated_at
		FROM conversations
		WHERE user_a_id = $1 AND user_b_id = $2
		`,
		userAID,
		userBID,
	).Scan(
		&conv.ID,
		&conv.UserAID,
		&conv.UserBID,
		&conv.CreatedAt,
		&conv.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return conv, nil
}

func (r *Repository) FindByID(ctx context.Context, id string) (*Conversation, error) {
	conv := &Conversation{}
	err := r.db.QueryRow(
		ctx,
		`
		SELECT
			id,
			user_a_id,
			user_b_id,
			created_at,
			updated_at
		FROM conversations
		WHERE id = $1
		`,
		id,
	).Scan(
		&conv.ID,
		&conv.UserAID,
		&conv.UserBID,
		&conv.CreatedAt,
		&conv.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return conv, nil
}

func (r *Repository) ConversationParticipantIDs(ctx context.Context, conversationID string) ([]string, error) {
	var userAID, userBID string
	err := r.db.QueryRow(
		ctx,
		`SELECT user_a_id, user_b_id FROM conversations WHERE id = $1`,
		conversationID,
	).Scan(&userAID, &userBID)
	if err != nil {
		return nil, err
	}
	return []string{userAID, userBID}, nil
}

func (r *Repository) ListByUserID(ctx context.Context, userID string) ([]Summary, error) {
	rows, err := r.db.Query(
		ctx,
		`
		SELECT
			c.id,
			c.user_a_id,
			c.user_b_id,
			c.created_at,
			c.updated_at,
			u.id,
			u.username,
			u.display_name,
			u.avatar_url,
			lm.id,
			lm.author_id,
			lm.content,
			lm.created_at
		FROM conversations c
		JOIN users u ON u.id = CASE
			WHEN c.user_a_id = $1 THEN c.user_b_id
			ELSE c.user_a_id
		END
		LEFT JOIN LATERAL (
			-- Mensagem só com enquete: a prévia mostra a pergunta.
			SELECT m.id, m.author_id, COALESCE(NULLIF(m.content, ''), '📊 ' || p.question, '') AS content, m.created_at
			FROM messages m
			LEFT JOIN polls p ON p.message_id = m.id
			WHERE m.conversation_id = c.id
			ORDER BY m.created_at DESC
			LIMIT 1
		) lm ON TRUE
		WHERE c.user_a_id = $1 OR c.user_b_id = $1
		ORDER BY COALESCE(lm.created_at, c.created_at) DESC
		`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summaries []Summary
	for rows.Next() {
		var s Summary
		var lmID *string
		var lmAuthorID *string
		var lmContent *string
		var lmCreatedAt *time.Time

		if err := rows.Scan(
			&s.ID,
			&s.UserAID,
			&s.UserBID,
			&s.CreatedAt,
			&s.UpdatedAt,
			&s.OtherUser.ID,
			&s.OtherUser.Username,
			&s.OtherUser.DisplayName,
			&s.OtherUser.AvatarURL,
			&lmID,
			&lmAuthorID,
			&lmContent,
			&lmCreatedAt,
		); err != nil {
			return nil, err
		}

		if lmID != nil {
			s.LastMessage = &LastMessage{
				ID:        *lmID,
				AuthorID:  *lmAuthorID,
				Content:   *lmContent,
				CreatedAt: *lmCreatedAt,
			}
		}

		summaries = append(summaries, s)
	}

	if summaries == nil {
		summaries = []Summary{}
	}

	return summaries, nil
}