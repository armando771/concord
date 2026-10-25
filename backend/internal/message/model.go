package message

import "time"

type Author struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	DisplayName string  `json:"display_name"`
	AvatarURL   *string `json:"avatar_url,omitempty"`
}

type Message struct {
	ID             string    `json:"id"`
	AuthorID       string    `json:"author_id"`
	Author         *Author   `json:"author,omitempty"`
	ChannelID      *string   `json:"channel_id,omitempty"`
	ConversationID *string   `json:"conversation_id,omitempty"`
	Content        string    `json:"content"`
	Poll           *Poll     `json:"poll,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
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
