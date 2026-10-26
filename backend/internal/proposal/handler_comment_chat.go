package proposal

import (
	"errors"
	"io"
	"log"
	"net/http"
	"path"
	"strconv"
	"strings"
	"unicode"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"gin-quickstart/backend/internal/media"
)

const (
	maxMediaDimension = 16384
	maxDurationMs     = 86_400_000
)

// React: POST /proposals/:id/comments/:commentId/reactions {"emoji": "👍"}.
func (h *Handler) React(c *gin.Context) {
	id, ok := proposalID(c)
	if !ok {
		return
	}
	commentID, ok := uuidParam(c, "commentId")
	if !ok {
		return
	}
	var body struct {
		Emoji string `json:"emoji"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	comment, err := h.service.React(c.Request.Context(), id, commentID, c.GetString("userID"), body.Emoji)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, comment)
}

// Unreact: DELETE /proposals/:id/comments/:commentId/reactions?emoji=👍 (como no chat).
func (h *Handler) Unreact(c *gin.Context) {
	id, ok := proposalID(c)
	if !ok {
		return
	}
	commentID, ok := uuidParam(c, "commentId")
	if !ok {
		return
	}
	comment, err := h.service.Unreact(c.Request.Context(), id, commentID, c.GetString("userID"), c.Query("emoji"))
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, comment)
}

// UploadCommentMedia recebe um anexo de comentário (multipart, campo "file", e
// opcionalmente width, height e duration_ms) e o deixa pendente até o
// comentário ser criado com a id dele.
func (h *Handler) UploadCommentMedia(c *gin.Context) {
	limit := media.MaxFileBytes + multipartOverhead
	incoming := c.Request.ContentLength
	if incoming < 0 {
		incoming = limit
	}
	if !h.space.HasRoom(incoming) {
		c.JSON(http.StatusInsufficientStorage, gin.H{"error": "server out of space"})
		return
	}
	if c.Request.ContentLength > limit {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "file too large"})
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, limit)

	reader, err := c.Request.MultipartReader()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid upload"})
		return
	}

	row := CommentAttachmentRow{UploaderID: c.GetString("userID")}
	saved, keep := false, false
	var head []byte
	var declared string
	// Qualquer saída antes do 201 apaga o arquivo que já foi para o disco.
	defer func() {
		if saved && !keep {
			if err := h.images.Remove(row.ID); err != nil {
				log.Printf("[proposal] remove rejected attachment %s: %v", row.ID, err)
			}
		}
	}()

	// Os campos podem vir antes ou depois do arquivo, que vai direto para o disco.
	for {
		part, err := reader.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			status, msg := uploadStatus(err)
			c.JSON(status, gin.H{"error": msg})
			return
		}
		switch part.FormName() {
		case "file":
			if saved {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid upload"})
				return
			}
			row.ID = uuid.NewString()
			row.Filename = sanitizeFilename(part.FileName())
			declared = part.Header.Get("Content-Type")
			row.SizeBytes, head, err = h.images.Save(row.ID, part, media.MaxFileBytes)
			if err != nil {
				status, msg := uploadStatus(err)
				c.JSON(status, gin.H{"error": msg})
				return
			}
			saved = true
		case "width", "height", "duration_ms":
			raw, err := io.ReadAll(io.LimitReader(part, 32))
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid upload"})
				return
			}
			switch part.FormName() {
			case "width":
				row.Width = parseOptionalPositive(string(raw), maxMediaDimension)
			case "height":
				row.Height = parseOptionalPositive(string(raw), maxMediaDimension)
			default:
				row.DurationMs = parseOptionalPositive(string(raw), maxDurationMs)
			}
		default:
			io.Copy(io.Discard, part)
		}
		part.Close()
	}
	if !saved {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid upload"})
		return
	}

	kind, contentType, ok := media.Sniff(head, declared)
	if !ok {
		c.JSON(http.StatusUnsupportedMediaType, gin.H{"error": "unsupported file type"})
		return
	}
	row.Kind, row.ContentType = string(kind), contentType

	attachment, err := h.service.RegisterCommentAttachment(c.Request.Context(), row)
	if err != nil {
		h.fail(c, err)
		return
	}
	keep = true
	c.JSON(http.StatusCreated, attachment)
}

// ServeCommentMedia entrega o anexo de um comentário sem token (<img>, <video> e
// <audio> não mandam Bearer, e o nome é um UUID novo a cada upload). Como em
// ServeImage, o tipo vale só se o arquivo ainda é do tipo guardado no banco, e
// a resposta sai com nosniff e CSP sandbox: nada aqui roda como página.
func (h *Handler) ServeCommentMedia(c *gin.Context) {
	notFound := func() { c.JSON(http.StatusNotFound, gin.H{"error": "media not found"}) }

	id := c.Param("id")
	if parsed, err := uuid.Parse(id); err != nil || parsed.String() != id {
		notFound()
		return
	}
	storedKind, storedType, err := h.service.CommentAttachmentMeta(c.Request.Context(), id)
	if err != nil {
		notFound()
		return
	}
	file, err := h.images.Open(id)
	if err != nil {
		notFound()
		return
	}
	defer file.Close()

	head := make([]byte, media.SniffLen)
	n, _ := io.ReadFull(file, head)
	kind, contentType, ok := media.Sniff(head[:n], "")
	if !ok || string(kind) != storedKind {
		// mp4 de áudio e de vídeo são o mesmo contêiner: o Sniff sem o tipo
		// declarado pode dizer "vídeo" para um m4a antigo. Confia no banco só para
		// essa troca, nunca para fora de image/video/audio.
		if !(ok && sameMP4Family(string(kind), storedKind)) {
			notFound()
			return
		}
		contentType = storedType
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		notFound()
		return
	}
	info, err := file.Stat()
	if err != nil {
		notFound()
		return
	}

	header := c.Writer.Header()
	header.Set("Content-Type", contentType)
	header.Set("X-Content-Type-Options", "nosniff")
	header.Set("Content-Security-Policy", "sandbox")
	header.Set("Cache-Control", "public, max-age=31536000, immutable")
	http.ServeContent(c.Writer, c.Request, "", info.ModTime(), file)
}

func sameMP4Family(sniffed, stored string) bool {
	return (sniffed == "video" || sniffed == "audio") && (stored == "video" || stored == "audio") &&
		sniffed != stored
}

// sanitizeFilename deixa só o nome do arquivo, sem caminho nem caracteres de controle.
func sanitizeFilename(name string) string {
	name = path.Base(strings.ReplaceAll(name, `\`, "/"))
	name = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, name)
	name = strings.TrimSpace(name)
	if runes := []rune(name); len(runes) > 200 {
		name = string(runes[:200])
	}
	if name == "" || name == "." || name == ".." || name == "/" {
		return "arquivo"
	}
	return name
}

// parseOptionalPositive lê um campo numérico opcional do upload; vazio,
// inválido ou fora de 1..max vira nil.
func parseOptionalPositive(raw string, max int) *int {
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || n <= 0 || n > max {
		return nil
	}
	return &n
}
