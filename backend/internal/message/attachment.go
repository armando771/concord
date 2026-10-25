package message

import (
	"errors"
	"time"
)

// MaxAttachmentsPerMessage é quantos arquivos cabem numa mensagem (como no Discord).
const MaxAttachmentsPerMessage = 10

var (
	ErrTooManyAttachments = errors.New("a message can have at most 10 attachments")
	ErrInvalidAttachment  = errors.New("invalid attachment")
	ErrAttachmentNotFound = errors.New("attachment not found")
)

type Attachment struct {
	ID          string `json:"id"`
	Kind        string `json:"kind"` // image | video | audio
	ContentType string `json:"content_type"`
	Filename    string `json:"filename"`
	SizeBytes   int64  `json:"size_bytes"`
	Width       *int   `json:"width,omitempty"`
	Height      *int   `json:"height,omitempty"`
	DurationMs  *int   `json:"duration_ms,omitempty"`
}

// storedAttachment é a linha completa (uso interno: upload, download, limpeza).
type storedAttachment struct {
	Attachment
	UploaderID     string
	MessageID      *string
	ChannelID      *string
	ConversationID *string
	CreatedAt      time.Time
}

// validateNewMessage confere texto e anexos antes de ir ao banco. A posse e a
// sala de cada anexo são conferidas na transação (CreateWithAttachments).
func validateNewMessage(content string, attachmentIDs []string) error {
	if content == "" && len(attachmentIDs) == 0 {
		return ErrContentRequired
	}
	if len(attachmentIDs) > MaxAttachmentsPerMessage {
		return ErrTooManyAttachments
	}
	seen := make(map[string]bool, len(attachmentIDs))
	for _, id := range attachmentIDs {
		if id == "" || seen[id] {
			return ErrInvalidAttachment
		}
		seen[id] = true
	}
	return nil
}
