package sticker

import (
	"encoding/json"
	"errors"
	"strings"
	"time"
	"unicode"
)

const (
	// MaxStickerBytes: limite por figurinha (1 MB).
	MaxStickerBytes int64 = 1 << 20

	// MaxStickersPerServer: limite de figurinhas por servidor.
	MaxStickersPerServer = 60

	MaxNameRunes = 32
)

var (
	ErrStickerNotFound     = errors.New("sticker not found")
	ErrServerFull          = errors.New("server sticker limit reached")
	ErrInvalidName         = errors.New("sticker name is required (max 32 characters)")
	ErrNotServerMember     = errors.New("you are not a member of this server")
	ErrCannotDeleteSticker = errors.New("only the uploader, moderators or server owner can delete this sticker")
	ErrCannotAddSticker    = errors.New("você não tem permissão para adicionar figurinhas neste servidor")
)

type Sticker struct {
	ID           string    `json:"id"`
	ServerID     string    `json:"server_id"`
	UploaderID   string    `json:"uploader_id"`
	UploaderName string    `json:"uploader_name,omitempty"`
	Name         string    `json:"name"`
	ContentType  string    `json:"content_type"`
	SizeBytes    int64     `json:"size_bytes"`
	CreatedAt    time.Time `json:"created_at"`
}

type CreatedEvent struct {
	ServerID string  `json:"server_id"`
	Sticker  Sticker `json:"sticker"`
}

type DeletedEvent struct {
	ServerID  string `json:"server_id"`
	StickerID string `json:"sticker_id"`
}

func sanitizeName(raw string) (string, error) {
	clean := strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, raw)
	clean = strings.TrimSpace(clean)
	runes := []rune(clean)
	if len(runes) == 0 || len(runes) > MaxNameRunes {
		return "", ErrInvalidName
	}
	return clean, nil
}

func marshalEvent(typ string, payload any) []byte {
	data, err := json.Marshal(map[string]any{
		"type":    typ,
		"payload": payload,
	})
	if err != nil {
		return nil
	}
	return data
}
