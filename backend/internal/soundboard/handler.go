package soundboard

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

// ServeFile entrega o arquivo do som (o <audio> manda o media token na URL).
func (h *Handler) ServeFile(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid media token"})
		return
	}
	// Qualquer pessoa logada: favorito de outro servidor tocado numa chamada é
	// ouvido por quem não é de lá, e o id (UUID) do som só chega a quem o vê
	// na mesa ou o ouve (docs/adr/0013-mesa-de-audio-por-servidor.md).
	if _, err := h.tokens.VerifyMediaToken(token); err != nil {
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
