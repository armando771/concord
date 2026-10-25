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
// ReorderEvent: nova ordem dos canais de um tipo (texto ou voz) do servidor.
// RequestID é o que o cliente mandou no pedido: ele reconhece o próprio eco.
type ReorderEvent struct {
	ServerID   string   `json:"server_id"`
	Type       string   `json:"type"`
	ChannelIDs []string `json:"channel_ids"`
	RequestID  string   `json:"request_id,omitempty"`
}
