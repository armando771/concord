package message

import "time"

type Author struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	DisplayName string  `json:"display_name"`
	AvatarURL   *string `json:"avatar_url,omitempty"`
}

type ReplyPreview struct {
	ID       string  `json:"id"`
	AuthorID string  `json:"author_id"`
	Author   *Author `json:"author,omitempty"`
	Content  string  `json:"content"`
}

type ReactionSummary struct {
	Emoji   string   `json:"emoji"`
	Count   int      `json:"count"`
	UserIDs []string `json:"user_ids"`
}

type ReactionRow struct {
	MessageID string
	UserID    string
	Emoji     string
}

type Message struct {
	ID             string            `json:"id"`
	AuthorID       string            `json:"author_id"`
	Author         *Author           `json:"author,omitempty"`
	ChannelID      *string           `json:"channel_id,omitempty"`
	ConversationID *string           `json:"conversation_id,omitempty"`
	ReplyToID      *string           `json:"reply_to_id,omitempty"`
	ReplyTo        *ReplyPreview     `json:"reply_to,omitempty"`
	Reactions      []ReactionSummary `json:"reactions,omitempty"`
	Content        string            `json:"content"`
	// Mensagem do próprio servidor (ex.: "birthday"); nil = mensagem comum.
	SystemKind *string `json:"system_kind,omitempty"`
	// "all"/"here" quando a mensagem pinga o canal (só dono/moderador, com
	// anti-spam); nil = não pinga ninguém, mesmo com "@all" no texto.
	MentionEveryone *string      `json:"mention_everyone"`
	Poll            *Poll        `json:"poll,omitempty"`
	Attachments     []Attachment `json:"attachments,omitempty"`
	CreatedAt       time.Time    `json:"created_at"`
}

type CreateEvent struct {
	ChannelID      *string  `json:"channel_id,omitempty"`
	ConversationID *string  `json:"conversation_id,omitempty"`
	ServerID       string   `json:"server_id,omitempty"`
	UserIDs        []string `json:"user_ids,omitempty"`
	Message        Message  `json:"message"`
}

type DeleteEvent struct {
	ChannelID      *string  `json:"channel_id,omitempty"`
	ConversationID *string  `json:"conversation_id,omitempty"`
	ServerID       string   `json:"server_id,omitempty"`
	UserIDs        []string `json:"user_ids,omitempty"`
	MessageID      string   `json:"message_id"`
}

type ReactionEvent struct {
	ChannelID      *string `json:"channel_id,omitempty"`
	ConversationID *string `json:"conversation_id,omitempty"`
	MessageID      string  `json:"message_id"`
	UserID         string  `json:"user_id"`
	Emoji          string  `json:"emoji"`
}
