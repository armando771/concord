package channel

import "time"

const (
	TypeText  = "text"
	TypeVoice = "voice"
)

type Channel struct {
	ID        string    `json:"id"`
	ServerID  string    `json:"server_id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Position  int       `json:"position"`
	CreatedBy string    `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CreateEvent struct {
	ServerID string  `json:"server_id"`
	Channel  Channel `json:"channel"`
}

type DeleteEvent struct {
	ServerID  string `json:"server_id"`
	ChannelID string `json:"channel_id"`
}

type ReorderEvent struct {
	ServerID string    `json:"server_id"`
	Channels []Channel `json:"channels"`
}
