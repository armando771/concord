package sticker

import (
	"context"
	"errors"
	"gin-quickstart/backend/internal/permission"
	"log"
	"mime"
	"net/http"

	"gin-quickstart/backend/internal/platform/media"

	"github.com/gin-gonic/gin"
)

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
