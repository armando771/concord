package message

import (
	"context"
	"errors"
	"net/http"
	"time"

	"gin-quickstart/backend/internal/permission"
	"gin-quickstart/backend/internal/ratelimit"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Limite leve da busca, por pessoa: digitar e paginar cabe folgado; um script
// martelando o banco, não.
const (
	searchPerUser     = 30
	searchWindow      = time.Minute
	searchLimiterKeys = 10000
)

// SearchStore faz a busca no banco (Repository.Search).
type SearchStore interface {
	Search(ctx context.Context, scope SearchScope, f SearchFilter, viewerID string) (*SearchPage, error)
}

// SnapshotLoader: as permissões do servidor inteiro (permission.Service).
type SnapshotLoader interface {
	Snapshot(ctx context.Context, serverID string) (*permission.Snapshot, error)
}

type SearchHandler struct {
	store     SearchStore
	snapshots SnapshotLoader
	access    RoomAccess
	limiter   *ratelimit.Limiter
}

func NewSearchHandler(store SearchStore, snapshots SnapshotLoader, access RoomAccess) *SearchHandler {
	return &SearchHandler{
		store:     store,
		snapshots: snapshots,
		access:    access,
		limiter:   ratelimit.New(searchPerUser, searchWindow, searchLimiterKeys),
	}
}

func SearchRoutes(router *gin.RouterGroup, handler *SearchHandler, authMiddleware gin.HandlerFunc) {
	router.GET("/servers/:id/messages/search", authMiddleware, handler.SearchServer)
	router.GET("/conversations/:id/messages/search", authMiddleware, handler.SearchConversation)
}

// begin: quem busca, limite e filtro. Responde o erro e devolve ok=false.
func (h *SearchHandler) begin(c *gin.Context) (string, SearchFilter, bool) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return "", SearchFilter{}, false
	}
	if retry, ok := h.limiter.Allow(userID); !ok {
		c.Header("Retry-After", ratelimit.RetryAfterSeconds(retry))
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many searches", "code": "rate_limited"})
		return "", SearchFilter{}, false
	}
	filter, err := ParseSearchParams(c.Request.URL.Query())
	if err != nil {
		var se *SearchError
		field := ""
		if errors.As(err, &se) {
			field = se.Field
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_search", "field": field})
		return "", SearchFilter{}, false
	}
	return userID, filter, true
}

func (h *SearchHandler) respond(c *gin.Context, scope SearchScope, filter SearchFilter, userID string) {
	if filter.Empty() {
		c.JSON(http.StatusBadRequest, gin.H{"error": ErrSearchEmpty.Error(), "code": "empty_search"})
		return
	}
	page, err := h.store.Search(c.Request.Context(), scope, filter, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to search messages"})
		return
	}
	c.JSON(http.StatusOK, page)
}

// SearchServer busca em todos os canais de texto do servidor que a pessoa vê
// (e cujo histórico ela lê). Quem não é membro recebe 404.
func (h *SearchHandler) SearchServer(c *gin.Context) {
	serverID := c.Param("id")
	userID, filter, ok := h.begin(c)
	if !ok {
		return
	}
	notFound := func() {
		c.JSON(http.StatusNotFound, gin.H{"error": "server not found", "code": "server_not_found"})
	}
	if _, err := uuid.Parse(serverID); err != nil {
		notFound()
		return
	}
	snap, err := h.snapshots.Snapshot(c.Request.Context(), serverID)
	if errors.Is(err, permission.ErrNotMember) || (err == nil && !snap.IsMember(userID)) {
		notFound()
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to search messages"})
		return
	}
	h.respond(c, SearchScope{ChannelIDs: SearchableChannels(snap, userID)}, filter, userID)
}

// SearchConversation busca numa DM ou grupo de que a pessoa participa.
func (h *SearchHandler) SearchConversation(c *gin.Context) {
	conversationID := c.Param("id")
	userID, filter, ok := h.begin(c)
	if !ok {
		return
	}
	if _, err := uuid.Parse(conversationID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "conversation not found"})
		return
	}
	if err := h.access.CanRead(c.Request.Context(), Room{ConversationID: conversationID}, userID); err != nil {
		// Quem não participa não descobre nem se a conversa existe.
		c.JSON(http.StatusNotFound, gin.H{"error": "conversation not found"})
		return
	}
	// O in: não tem sentido numa DM: só a própria conversa.
	filter.In = nil
	h.respond(c, SearchScope{ConversationID: conversationID}, filter, userID)
}
