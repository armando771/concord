package music

import "github.com/google/uuid"

// Track é o que o yt-dlp diz de um vídeo.
type Track struct {
	VideoID    string
	Title      string
	Artist     string
	Channel    string
	Thumbnail  string
	DurationMs int64
	IsLive     bool
	// HasVideo: há imagem em movimento (não é "Art Track" de capa fixa).
	HasVideo bool
}

type UserRef struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	DisplayName string  `json:"display_name"`
	AvatarURL   *string `json:"avatar_url,omitempty"`
}

// Item é um pedido na fila de um canal de voz.
type Item struct {
	ID            string
	Track         Track
	RequestedBy   UserRef
	TextChannelID string
	// Arquivos no cache, preenchidos quando baixados.
	AudioPath string
	VideoPath string
}

func NewItem(t Track, by UserRef, textChannelID string) *Item {
	return &Item{ID: uuid.NewString(), Track: t, RequestedBy: by, TextChannelID: textChannelID}
}
