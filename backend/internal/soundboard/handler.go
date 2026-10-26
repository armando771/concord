package soundboard

import (
	"context"
	"errors"
	"gin-quickstart/backend/internal/permission"
	"io"
	"log"
	"mime"
	"net/http"
	"strconv"
	"strings"
	"syscall"

	"gin-quickstart/backend/internal/media"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const multipartOverhead = 256 << 10 // 256 KB para cabeçalhos e campos de texto

type soundRepo interface {
	Create(ctx context.Context, s *Sound) error
	ListByServer(ctx context.Context, serverID string) ([]Sound, error)
	FindByID(ctx context.Context, id string) (*Sound, error)
	CountByServer(ctx context.Context, serverID string) (int, error)
	Delete(ctx context.Context, id string) error
}

type serverChecker interface {
	IsMember(ctx context.Context, serverID, userID string) (bool, error)
}

// permissionChecker devolve as permissões do membro no servidor
// (permission.Service).
type permissionChecker interface {
	ServerPerms(ctx context.Context, serverID, userID string) (int64, error)
}

type spaceChecker interface {
	HasRoom(incoming int64) bool
}

type mediaTokens interface {
	VerifyMediaToken(token string) (userID string, err error)
}

type eventPublisher interface {
	BroadcastToRoom(room string, event []byte)
}

type Handler struct {
	repo          soundRepo
	store         *media.Store
	space         spaceChecker
	servers       serverChecker
	permissions   permissionChecker
	tokens        mediaTokens
	publisher     eventPublisher
	maxSoundBytes int64
	maxPerServer  int
}

func NewHandler(
	repo soundRepo,
	store *media.Store,
	space spaceChecker,
	servers serverChecker,
	permissions permissionChecker,
	tokens mediaTokens,
	publisher eventPublisher,
) *Handler {
	return &Handler{
		repo:          repo,
		store:         store,
		space:         space,
		servers:       servers,
		permissions:   permissions,
		tokens:        tokens,
		publisher:     publisher,
		maxSoundBytes: MaxSoundBytes,
		maxPerServer:  MaxSoundsPerServer,
	}
}

func isTooLarge(err error) bool {
	var maxBytes *http.MaxBytesError
	return errors.Is(err, media.ErrTooLarge) || errors.As(err, &maxBytes)
}

func saveErrorStatus(err error) (int, string) {
	switch {
	case isTooLarge(err):
		return http.StatusRequestEntityTooLarge, "file too large (max 5 MB)"
	case errors.Is(err, syscall.ENOSPC):
		return http.StatusInsufficientStorage, "server out of space"
	default:
		return http.StatusBadRequest, "invalid upload"
	}
}

func (h *Handler) List(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	serverID := c.Param("id")
	ctx := c.Request.Context()

	isMember, err := h.servers.IsMember(ctx, serverID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check membership"})
		return
	}
	if !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": ErrNotServerMember.Error()})
		return
	}

	sounds, err := h.repo.ListByServer(ctx, serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list sounds"})
		return
	}
	c.JSON(http.StatusOK, sounds)
}

func (h *Handler) Upload(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	uploaderID := userID.(string)
	serverID := c.Param("id")
	ctx := c.Request.Context()

	isMember, err := h.servers.IsMember(ctx, serverID, uploaderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check membership"})
		return
	}
	if !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": ErrNotServerMember.Error()})
		return
	}

	perms, err := h.permissions.ServerPerms(ctx, serverID, uploaderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check permissions"})
		return
	}
	if !permission.Has(perms, permission.UseSoundboard) {
		c.JSON(http.StatusForbidden, gin.H{"error": permission.ErrMissingPermission.Error(), "code": "missing_permission"})
		return
	}

	count, err := h.repo.CountByServer(ctx, serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check server soundboard limit"})
		return
	}
	if count >= h.maxPerServer {
		c.JSON(http.StatusConflict, gin.H{"error": ErrServerFull.Error()})
		return
	}

	incoming := c.Request.ContentLength
	if incoming < 0 {
		incoming = h.maxSoundBytes
	}
	if !h.space.HasRoom(incoming) {
		c.JSON(http.StatusInsufficientStorage, gin.H{"error": "server out of space"})
		return
	}
	if c.Request.ContentLength > h.maxSoundBytes+multipartOverhead {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "file too large (max 5 MB)"})
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, h.maxSoundBytes+multipartOverhead)

	reader, err := c.Request.MultipartReader()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid upload"})
		return
	}

	sound := &Sound{
		ServerID:   serverID,
		UploaderID: uploaderID,
	}

	var (
		saved    bool
		keep     bool
		head     []byte
		declared string
		rawName  string
		rawEmoji string
		rawDur   string
	)
	defer func() {
		if saved && !keep {
			if err := h.store.Remove(sound.ID); err != nil {
				log.Printf("failed to remove rejected soundboard upload %s: %v", sound.ID, err)
			}
		}
	}()

	for {
		part, err := reader.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			if isTooLarge(err) {
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "file too large (max 5 MB)"})
			} else {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid upload"})
			}
			return
		}

		switch part.FormName() {
		case "file":
			if saved {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid upload"})
				return
			}
			sound.ID = uuid.NewString()
			declared = part.Header.Get("Content-Type")
			sound.SizeBytes, head, err = h.store.Save(sound.ID, part, h.maxSoundBytes)
			if err != nil {
				status, msg := saveErrorStatus(err)
				c.JSON(status, gin.H{"error": msg})
				return
			}
			saved = true
		case "name", "emoji", "duration_ms":
			raw, err := io.ReadAll(io.LimitReader(part, 256))
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid upload"})
				return
			}
			switch part.FormName() {
			case "name":
				rawName = string(raw)
			case "emoji":
				rawEmoji = string(raw)
			case "duration_ms":
				rawDur = string(raw)
			}
		default:
			io.Copy(io.Discard, part)
		}
		part.Close()
	}

	if !saved {
		c.JSON(http.StatusBadRequest, gin.H{"error": "audio file is required"})
		return
	}

	name, err := sanitizeName(rawName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	sound.Name = name
	sound.Emoji = sanitizeEmoji(rawEmoji)

	dur, err := strconv.Atoi(strings.TrimSpace(rawDur))
	if err != nil || dur < MinSoundDurationMs || dur > MaxSoundDurationMs {
		c.JSON(http.StatusBadRequest, gin.H{"error": ErrInvalidDuration.Error()})
		return
	}
	sound.DurationMs = dur

	kind, contentType, ok := media.Sniff(head, declared)
	if !ok || kind != media.KindAudio {
		c.JSON(http.StatusUnsupportedMediaType, gin.H{"error": "only audio files (mp3, wav, ogg, m4a, webm) are allowed"})
		return
	}
	sound.ContentType = contentType

	if err := h.repo.Create(ctx, sound); err != nil {
		log.Printf("failed to save soundboard item %s: %v", sound.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save sound"})
		return
	}
	keep = true

	if h.publisher != nil {
		h.publisher.BroadcastToRoom("server:"+serverID, marshalEvent("soundboard:created", CreatedEvent{
			ServerID: serverID,
			Sound:    *sound,
		}))
	}

	c.JSON(http.StatusCreated, sound)
}

func (h *Handler) Delete(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	actorID := userID.(string)
	serverID := c.Param("id")
	soundID := c.Param("soundId")
	ctx := c.Request.Context()

	sound, err := h.repo.FindByID(ctx, soundID)
	if errors.Is(err, ErrSoundNotFound) || (sound != nil && sound.ServerID != serverID) {
		c.JSON(http.StatusNotFound, gin.H{"error": ErrSoundNotFound.Error()})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load sound"})
		return
	}

	allowed := sound.UploaderID == actorID
	if !allowed {
		perms, err := h.permissions.ServerPerms(ctx, serverID, actorID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check permissions"})
			return
		}
		allowed = permission.Has(perms, permission.ManageExpressions)
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": ErrCannotDeleteSound.Error()})
		return
	}

	if err := h.repo.Delete(ctx, sound.ID); err != nil {
		if errors.Is(err, ErrSoundNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": ErrSoundNotFound.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete sound"})
		return
	}

	if err := h.store.Remove(sound.ID); err != nil {
		log.Printf("failed to remove sound file %s: %v", sound.ID, err)
	}

	if h.publisher != nil {
		h.publisher.BroadcastToRoom("server:"+serverID, marshalEvent("soundboard:deleted", DeletedEvent{
			ServerID: serverID,
			SoundID:  sound.ID,
		}))
	}

	c.JSON(http.StatusOK, gin.H{"message": "sound deleted"})
}

func (h *Handler) ServeFile(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid media token"})
		return
	}
	userID, err := h.tokens.VerifyMediaToken(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid media token"})
		return
	}

	ctx := c.Request.Context()
	notFound := func() { c.JSON(http.StatusNotFound, gin.H{"error": "sound not found"}) }

	sound, err := h.repo.FindByID(ctx, c.Param("soundId"))
	if errors.Is(err, ErrSoundNotFound) {
		notFound()
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load sound"})
		return
	}

	isMember, err := h.servers.IsMember(ctx, sound.ServerID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check access"})
		return
	}
	if !isMember {
		notFound()
		return
	}

	file, err := h.store.Open(sound.ID)
	if err != nil {
		log.Printf("soundboard %s has no file: %v", sound.ID, err)
		notFound()
		return
	}
	defer file.Close()

	header := c.Writer.Header()
	header.Set("Content-Type", sound.ContentType)
	header.Set("X-Content-Type-Options", "nosniff")
	header.Set("Cache-Control", "private, max-age=86400")
	header.Set("Content-Disposition", mime.FormatMediaType("inline", map[string]string{"filename": sound.Name}))
	http.ServeContent(c.Writer, c.Request, "", sound.CreatedAt, file)
}
