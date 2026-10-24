package conversation

import (
	"net/http"

	"gin-quickstart/backend/internal/friendship"
	"gin-quickstart/backend/internal/server"
	"gin-quickstart/backend/internal/user"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service       *Service
	friendService *friendship.Service
	serverService *server.Service
	userService   *user.Service
}

func ConversationHandler(service *Service, friendService *friendship.Service, serverService *server.Service, userService *user.Service) *Handler {
	return &Handler{
		service:       service,
		friendService: friendService,
		serverService: serverService,
		userService:   userService,
	}
}

func (h *Handler) List(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	summaries, err := h.service.ListByUserID(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list conversations"})
		return
	}

	c.JSON(http.StatusOK, summaries)
}

func (h *Handler) GetOrCreateWith(c *gin.Context) {
	otherUserID := c.Param("userId")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if otherUserID == userID.(string) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot start a conversation with yourself"})
		return
	}

	otherUser, err := h.userService.FindByID(c.Request.Context(), otherUserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// DM liberada entre amigos ou entre quem divide um servidor.
	areFriends, _ := h.friendService.AreFriends(c.Request.Context(), userID.(string), otherUser.ID)
	if !areFriends {
		shares, err := h.serverService.SharesServer(c.Request.Context(), userID.(string), otherUser.ID)
		if err != nil || !shares {
			c.JSON(http.StatusForbidden, gin.H{"error": "you can only message friends or people from your servers"})
			return
		}
	}

	conv, err := h.service.GetOrCreateWith(c.Request.Context(), userID.(string), otherUser.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create conversation"})
		return
	}

	c.JSON(http.StatusOK, conv)
}

func (h *Handler) Get(c *gin.Context) {
	id := c.Param("id")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	isParticipant, err := h.service.IsParticipant(c.Request.Context(), id, userID.(string))
	if err != nil || !isParticipant {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not a participant of this conversation"})
		return
	}

	conv, err := h.service.FindByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "conversation not found"})
		return
	}

	c.JSON(http.StatusOK, conv)
}
