package message

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func MessageRepository(db *pgxpool.Pool) *Repository {
	return &Repository{
		db: db,
	}
}

const messageColumns = `
	m.id,
	m.author_id,
	u.username,
	u.display_name,
	u.avatar_url,
	m.channel_id,
	m.conversation_id,
	m.content,
	m.created_at
`

const messageFrom = `
	FROM messages m
	JOIN users u ON u.id = m.author_id
`

func (r *Repository) Create(ctx context.Context, msg *Message) error {
	return r.db.QueryRow(
		ctx,
		`
		INSERT INTO messages (id, author_id, channel_id, conversation_id, content)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING
			id,
			author_id,
			channel_id,
			conversation_id,
			content,
			created_at
		`,
		msg.ID,
		msg.AuthorID,
		msg.ChannelID,
		msg.ConversationID,
		msg.Content,
	).Scan(
		&msg.ID,
		&msg.AuthorID,
		&msg.ChannelID,
		&msg.ConversationID,
		&msg.Content,
		&msg.CreatedAt,
	)
}

func (r *Repository) FindByID(ctx context.Context, id string) (*Message, error) {
	msg := &Message{Author: &Author{}}
	err := r.db.QueryRow(
		ctx,
		`
		SELECT `+messageColumns+`
		`+messageFrom+`
		WHERE m.id = $1
		`,
		id,
	).Scan(
		&msg.ID,
		&msg.AuthorID,
		&msg.Author.Username,
		&msg.Author.DisplayName,
		&msg.Author.AvatarURL,
		&msg.ChannelID,
		&msg.ConversationID,
		&msg.Content,
		&msg.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	msg.Author.ID = msg.AuthorID
	return msg, nil
}

func (r *Repository) ListByChannel(ctx context.Context, channelID string, limit int, before string) ([]Message, error) {
	var rows pgx.Rows
	var err error

	if before == "" {
		rows, err = r.db.Query(
			ctx,
			`
			SELECT `+messageColumns+`
			`+messageFrom+`
			WHERE m.channel_id = $1
			ORDER BY m.created_at DESC, m.id DESC
			LIMIT $2
			`,
			channelID,
			limit,
		)
	} else {
		rows, err = r.db.Query(
			ctx,
			`
			SELECT `+messageColumns+`
			`+messageFrom+`
			WHERE m.channel_id = $1
			AND m.id < $2::uuid
			ORDER BY m.created_at DESC, m.id DESC
			LIMIT $3
			`,
			channelID,
			before,
			limit,
		)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanMessages(rows)
}

func (r *Repository) ListByConversation(ctx context.Context, conversationID string, limit int, before string) ([]Message, error) {
	var rows pgx.Rows
	var err error

	if before == "" {
		rows, err = r.db.Query(
			ctx,
			`
			SELECT `+messageColumns+`
			`+messageFrom+`
			WHERE m.conversation_id = $1
			ORDER BY m.created_at DESC, m.id DESC
			LIMIT $2
			`,
			conversationID,
			limit,
		)
	} else {
		rows, err = r.db.Query(
			ctx,
			`
			SELECT `+messageColumns+`
			`+messageFrom+`
			WHERE m.conversation_id = $1
			AND m.id < $2::uuid
			ORDER BY m.created_at DESC, m.id DESC
			LIMIT $3
			`,
			conversationID,
			before,
			limit,
		)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanMessages(rows)
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(
		ctx,
		`DELETE FROM messages WHERE id = $1`,
		id,
	)
	return err
}

type rowScanner interface {
	Next() bool
	Scan(dest ...interface{}) error
}

func scanMessages(rows rowScanner) ([]Message, error) {
	var messages []Message
	for rows.Next() {
		var msg Message
		msg.Author = &Author{}
		if err := rows.Scan(
			&msg.ID,
			&msg.AuthorID,
			&msg.Author.Username,
			&msg.Author.DisplayName,
			&msg.Author.AvatarURL,
			&msg.ChannelID,
			&msg.ConversationID,
			&msg.Content,
			&msg.CreatedAt,
		); err != nil {
			return nil, err
		}
		msg.Author.ID = msg.AuthorID
		messages = append(messages, msg)
	}

	if messages == nil {
		messages = []Message{}
	}

	return messages, nil
}
