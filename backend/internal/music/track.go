package music

import (
	"time"

	"github.com/google/uuid"
)

// Track é o que o yt-dlp diz de um vídeo (o JSON é o da sessão salva,
// session.go: só o ID do vídeo, que não expira, e o que o painel mostra).
type Track struct {
	VideoID    string `json:"video_id"`
	Title      string `json:"title"`
	Artist     string `json:"artist"`
	Channel    string `json:"channel"`
	Thumbnail  string `json:"thumbnail"`
	DurationMs int64  `json:"duration_ms"`
	IsLive     bool   `json:"is_live"`
	// HasVideo: há imagem em movimento (não é "Art Track" de capa fixa).
	HasVideo bool `json:"has_video"`
}

type UserRef struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	DisplayName string  `json:"display_name"`
	AvatarURL   *string `json:"avatar_url,omitempty"`
}

// Item é um pedido na fila de um canal de voz.
type Item struct {
	ID            string  `json:"id"`
	Track         Track   `json:"track"`
	RequestedBy   UserRef `json:"requested_by"`
	TextChannelID string  `json:"text_channel_id"`
	// Arquivos no cache, preenchidos quando baixados.
	AudioPath string `json:"-"`
	VideoPath string `json:"-"`
	// ResumeAt: de onde a faixa começa (retomada depois de reiniciar o servidor).
	ResumeAt time.Duration `json:"-"`
}

func NewItem(t Track, by UserRef, textChannelID string) *Item {
	return &Item{ID: uuid.NewString(), Track: t, RequestedBy: by, TextChannelID: textChannelID}
}
