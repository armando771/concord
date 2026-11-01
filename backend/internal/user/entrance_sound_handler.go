package user

import (
	"errors"
	"io"
	"log"
	"net/http"
	"syscall"

	"gin-quickstart/backend/internal/platform/media"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var errNotAudio = errors.New("not an audio file")

// EntranceSoundHandler sobe, remove e serve o som de entrada. O corpo do POST
// é o próprio arquivo (sem multipart): é um arquivo só, pequeno.
type EntranceSoundHandler struct {
	set      mediaSetter // ProfileService.SetEntranceSound
	store    *media.Store
	space    spaceChecker
	maxBytes int64 // MaxEntranceSoundBytes; testes diminuem
}

func NewEntranceSoundHandler(service *ProfileService, store *media.Store, space spaceChecker) *EntranceSoundHandler {
	return &EntranceSoundHandler{
		set:      service.SetEntranceSound,
		store:    store,
		space:    space,
		maxBytes: MaxEntranceSoundBytes,
	}
}

// Upload: POST /users/me/entrance-sound?duration_ms=N com o áudio no corpo.
func (h *EntranceSoundHandler) Upload(c *gin.Context) {
	userID, ok := currentUser(c)
	if !ok {
		return
	}
	if _, err := parseEntranceDuration(c.Query("duration_ms")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	id, err := h.saveAudio(c.Request)
	if err != nil {
		status, msg := entranceSaveStatus(err)
		c.JSON(status, gin.H{"error": msg})
		return
	}
	url := entranceSoundURL(id)
	u, old, err := h.set(c.Request.Context(), userID, &url)
	if err != nil {
		h.removeFile(id)
		respondProfileError(c, err)
		return
	}
	h.removeURL(old)
	c.JSON(http.StatusOK, u.Self())
}

// Delete volta ao som padrão e apaga o arquivo.
func (h *EntranceSoundHandler) Delete(c *gin.Context) {
	userID, ok := currentUser(c)
	if !ok {
		return
	}
	u, old, err := h.set(c.Request.Context(), userID, nil)
	if err != nil {
		respondProfileError(c, err)
		return
	}
	h.removeURL(old)
	c.JSON(http.StatusOK, u.Self())
}

// saveAudio grava o corpo com um nome novo e confere que é áudio de verdade
// (pelos bytes, não pelo Content-Type). Qualquer erro não deixa arquivo.
func (h *EntranceSoundHandler) saveAudio(r *http.Request) (string, error) {
	incoming := max(r.ContentLength, h.maxBytes)
	if !h.space.HasRoom(incoming) {
		return "", syscall.ENOSPC
	}
	id := uuid.NewString()
	_, head, err := h.store.Save(id, r.Body, h.maxBytes)
	if err != nil {
		return "", err
	}
	if _, ok := sniffAudio(head, r.Header.Get("Content-Type")); !ok {
		h.removeFile(id)
		return "", errNotAudio
	}
	return id, nil
}

func entranceSaveStatus(err error) (int, string) {
	if errors.Is(err, errNotAudio) {
		return http.StatusUnsupportedMediaType, "only audio files (mp3, wav, ogg, m4a, webm) are allowed"
	}
	return saveStatus(err)
}

// sniffAudio aceita só os áudios do media.Sniff (os mesmos da mesa de áudio).
func sniffAudio(head []byte, declared string) (string, bool) {
	kind, contentType, ok := media.Sniff(head, declared)
	return contentType, ok && kind == media.KindAudio
}

func (h *EntranceSoundHandler) removeURL(url *string) {
	if id, ok := entranceSoundIDFromURL(url); ok {
		h.removeFile(id)
	}
}

func (h *EntranceSoundHandler) removeFile(id string) {
	if err := h.store.Remove(id); err != nil {
		log.Printf("[profile] failed to remove entrance sound %s: %v", id, err)
	}
}

// Serve entrega o som sem token, como o avatar: o <audio> não manda Bearer e o
// nome é um UUID novo a cada upload (não dá para adivinhar e pode ficar em
// cache para sempre).
func (h *EntranceSoundHandler) Serve(c *gin.Context) {
	notFound := func() { c.JSON(http.StatusNotFound, gin.H{"error": "sound not found"}) }
	id, ok := parseSoundID(c.Param("id"))
	if !ok {
		notFound()
		return
	}
	file, err := h.store.Open(id)
	if err != nil {
		notFound()
		return
	}
	defer file.Close()

	head := make([]byte, media.SniffLen)
	n, _ := io.ReadFull(file, head)
	// "audio/" desempata m4a e webm, que o Sniff também reconhece como vídeo.
	contentType, ok := sniffAudio(head[:n], "audio/")
	if !ok {
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
	header.Set("Cache-Control", "public, max-age=31536000, immutable")
	// ServeContent volta ao começo do arquivo antes de responder.
	http.ServeContent(c.Writer, c.Request, "", info.ModTime(), file)
}
