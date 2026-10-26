package sticker

import (
	"context"
	"errors"
	"gin-quickstart/backend/internal/permission"
	"io"
	"log"
	"mime"
	"net/http"
	"syscall"

	"gin-quickstart/backend/internal/media"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const multipartOverhead = 256 << 10

type stickerRepo interface {
	Create(ctx context.Context, s *Sticker) error
	ListByServer(ctx context.Context, serverID string) ([]Sticker, error)
	FindByID(ctx context.Context, id string) (*Sticker, error)
	CountByServer(ctx context.Context, serverID string) (int, error)
	Delete(ctx context.Context, id string) error
}

type serverChecker interface {
	IsMember(ctx context.Context, serverID, userID string) (bool, error)
}

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
	repo            stickerRepo
	store           *media.Store
	space           spaceChecker
	servers         serverChecker
	permissions     permissionChecker
	tokens          mediaTokens
	publisher       eventPublisher
	maxPerServer    int
	maxStickerBytes int64
}

func NewHandler(
	repo stickerRepo,
	store *media.Store,
	space spaceChecker,
	servers serverChecker,
	permissions permissionChecker,
	tokens mediaTokens,
	publisher eventPublisher,
) *Handler {
	return &Handler{
		repo:            repo,
		store:           store,
		space:           space,
		servers:         servers,
		permissions:     permissions,
		tokens:          tokens,
		publisher:       publisher,
		maxPerServer:    MaxStickersPerServer,
		maxStickerBytes: MaxStickerBytes,
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

	stickers, err := h.repo.ListByServer(ctx, serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list stickers"})
		return
	}
	c.JSON(http.StatusOK, stickers)
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

	count, err := h.repo.CountByServer(ctx, serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check server sticker limit"})
		return
	}
	if count >= h.maxPerServer {
		c.JSON(http.StatusConflict, gin.H{"error": ErrServerFull.Error()})
		return
	}

	incoming := c.Request.ContentLength
	if incoming < 0 {
		incoming = h.maxStickerBytes
	}
	if !h.space.HasRoom(incoming) {
		c.JSON(http.StatusInsufficientStorage, gin.H{"error": "server out of space"})
		return
	}
	if c.Request.ContentLength > h.maxStickerBytes+multipartOverhead {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "file too large (max 1 MB)"})
		return
	}

	reader, err := c.Request.MultipartReader()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "multipart/form-data required"})
		return
	}

	sticker := &Sticker{
		ID:         uuid.New().String(),
		ServerID:   serverID,
		UploaderID: uploaderID,
	}

	var (
		rawName  string
		head     []byte
		declared string
		saved    bool
		keep     bool
	)

	defer func() {
		if saved && !keep {
			_ = h.store.Remove(sticker.ID)
		}
	}()

	for {
		part, err := reader.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid multipart body"})
			return
		}

		field := part.FormName()
		switch {
		case field == "file" && !saved:
			declared = part.Header.Get("Content-Type")
			size, sniffBytes, err := h.store.Save(sticker.ID, part, h.maxStickerBytes)
			if errors.Is(err, media.ErrTooLarge) {
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "file too large (max 1 MB)"})
				return
			}
			if errors.Is(err, syscall.ENOSPC) {
				c.JSON(http.StatusInsufficientStorage, gin.H{"error": "server out of space"})
				return
			}
			if err != nil {
				log.Printf("sticker save failed: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file"})
				return
			}
			saved = true
			sticker.SizeBytes = size
			head = sniffBytes

		case field == "name":
			raw, _ := io.ReadAll(io.LimitReader(part, 1024))
			rawName = string(raw)

		default:
			io.Copy(io.Discard, part)
		}
		part.Close()
	}

	if !saved {
		c.JSON(http.StatusBadRequest, gin.H{"error": "image file is required"})
		return
	}

	name, err := sanitizeName(rawName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	sticker.Name = name

	kind, contentType, ok := media.Sniff(head, declared)
	if !ok || kind != media.KindImage || (contentType != "image/png" && contentType != "image/webp" && contentType != "image/gif") {
		c.JSON(http.StatusUnsupportedMediaType, gin.H{"error": "only image files (png, webp, gif) are allowed for stickers"})
		return
	}
	sticker.ContentType = contentType

	if err := h.repo.Create(ctx, sticker); err != nil {
		log.Printf("sticker create record failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save sticker"})
		return
	}
	keep = true

	if h.publisher != nil {
		h.publisher.BroadcastToRoom("server:"+serverID, marshalEvent("sticker:created", CreatedEvent{
			ServerID: serverID,
			Sticker:  *sticker,
		}))
	}

	c.JSON(http.StatusCreated, sticker)
}

func (h *Handler) Delete(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	actorID := userID.(string)
	serverID := c.Param("id")
	stickerID := c.Param("stickerId")
	ctx := c.Request.Context()

	stk, err := h.repo.FindByID(ctx, stickerID)
	if errors.Is(err, ErrStickerNotFound) || (stk != nil && stk.ServerID != serverID) {
		c.JSON(http.StatusNotFound, gin.H{"error": ErrStickerNotFound.Error()})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load sticker"})
		return
	}

	allowed := stk.UploaderID == actorID
	if !allowed {
		perms, err := h.permissions.ServerPerms(ctx, serverID, actorID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check permissions"})
			return
		}
		allowed = permission.Has(perms, permission.ManageExpressions)
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": ErrCannotDeleteSticker.Error()})
		return
	}

	if err := h.repo.Delete(ctx, stk.ID); err != nil {
		if errors.Is(err, ErrStickerNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": ErrStickerNotFound.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete sticker"})
		return
	}

	if err := h.store.Remove(stk.ID); err != nil {
		log.Printf("failed to remove sticker file %s: %v", stk.ID, err)
	}

	if h.publisher != nil {
		h.publisher.BroadcastToRoom("server:"+serverID, marshalEvent("sticker:deleted", DeletedEvent{
			ServerID:  serverID,
			StickerID: stk.ID,
		}))
	}

	c.JSON(http.StatusOK, gin.H{"message": "sticker deleted"})
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
	notFound := func() { c.JSON(http.StatusNotFound, gin.H{"error": "sticker not found"}) }

	stk, err := h.repo.FindByID(ctx, c.Param("stickerId"))
	if errors.Is(err, ErrStickerNotFound) {
		notFound()
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load sticker"})
		return
	}

	isMember, err := h.servers.IsMember(ctx, stk.ServerID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check access"})
		return
	}
	if !isMember {
		notFound()
		return
	}

	file, err := h.store.Open(stk.ID)
	if err != nil {
		log.Printf("sticker %s has no file: %v", stk.ID, err)
		notFound()
		return
	}
	defer file.Close()

	header := c.Writer.Header()
	header.Set("Content-Type", stk.ContentType)
	header.Set("X-Content-Type-Options", "nosniff")
	header.Set("Cache-Control", "public, max-age=86400")
	header.Set("Content-Disposition", mime.FormatMediaType("inline", map[string]string{"filename": stk.Name}))
	http.ServeContent(c.Writer, c.Request, "", stk.CreatedAt, file)
}
