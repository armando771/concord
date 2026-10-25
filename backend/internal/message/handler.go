package message

import (
	"errors"
	"net/http"
	"strconv"

	"gin-quickstart/backend/internal/channel"
	"gin-quickstart/backend/internal/conversation"
	"gin-quickstart/backend/internal/friendship"
	"gin-quickstart/backend/internal/server"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service             *Service
	channelService      *channel.Service
	conversationService *conversation.Service
	friendService       *friendship.Service
	serverService       *server.Service
	access              RoomAccess
}

func MessageHandler(service *Service, channelService *channel.Service, conversationService *conversation.Service, friendService *friendship.Service, serverService *server.Service) *Handler {
	return &Handler{
		service:             service,
		channelService:      channelService,
		conversationService: conversationService,
		friendService:       friendService,
		serverService:       serverService,
		access:              NewServiceRoomAccess(channelService, serverService, conversationService, friendService),
	}
}

func (h *Handler) getUserID(c *gin.Context) (string, bool) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return "", false
	}
	return userID.(string), true
}

func parseListParams(c *gin.Context) (limit int, before string) {
	limit = 50
	if raw := c.Query("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}
	before = c.Query("before")
	return
}

func (h *Handler) CreateChannelMessage(c *gin.Context) {
	channelID := c.Param("channelId")

	var input struct {
		Content       string   `json:"content"`
		AttachmentIDs []string `json:"attachment_ids"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	ch, err := h.channelService.FindByID(c.Request.Context(), channelID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
		return
	}

	isMember, err := h.serverService.IsMember(c.Request.Context(), ch.ServerID, userID)
	if err != nil || !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not a member of this server"})
		return
	}

	msg, err := h.service.CreateChannelMessage(c.Request.Context(), channelID, userID, input.Content, input.AttachmentIDs)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, msg)
}

func (h *Handler) ListChannelMessages(c *gin.Context) {
	channelID := c.Param("channelId")

	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	ch, err := h.channelService.FindByID(c.Request.Context(), channelID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
		return
	}

	isMember, err := h.serverService.IsMember(c.Request.Context(), ch.ServerID, userID)
	if err != nil || !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not a member of this server"})
		return
	}

	limit, before := parseListParams(c)

	messages, err := h.service.ListChannelMessages(c.Request.Context(), channelID, userID, limit, before)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list messages"})
		return
	}

	c.JSON(http.StatusOK, messages)
}

func (h *Handler) DeleteChannelMessage(c *gin.Context) {
	channelID := c.Param("channelId")
	messageID := c.Param("messageId")

	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	if err := h.service.DeleteChannelMessage(c.Request.Context(), channelID, messageID, userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "message deleted"})
}

func (h *Handler) CreateConversationMessage(c *gin.Context) {
	conversationID := c.Param("id")

	var input struct {
		Content       string   `json:"content"`
		AttachmentIDs []string `json:"attachment_ids"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	if !h.canSendToConversation(c, conversationID, userID) {
		return
	}

	msg, err := h.service.CreateConversationMessage(c.Request.Context(), conversationID, userID, input.Content, input.AttachmentIDs)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, msg)
}

// canSendToConversation confere se userID pode escrever na DM; se não puder,
// já responde o erro.
func (h *Handler) canSendToConversation(c *gin.Context, conversationID string, userID string) bool {
	err := h.access.CanWrite(c.Request.Context(), Room{ConversationID: conversationID}, userID)
	switch {
	case err == nil:
		return true
	case errors.Is(err, ErrRoomNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "conversation not found"})
	case errors.Is(err, ErrNoRoomAccess):
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not a participant of this conversation"})
	case errors.Is(err, ErrCannotMessage):
		c.JSON(http.StatusForbidden, gin.H{"error": "you can only message friends or people from your servers"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check access"})
	}
	return false
}

func (h *Handler) ListConversationMessages(c *gin.Context) {
	conversationID := c.Param("id")

	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	isParticipant, err := h.conversationService.IsParticipant(c.Request.Context(), conversationID, userID)
	if err != nil || !isParticipant {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not a participant of this conversation"})
		return
	}

	limit, before := parseListParams(c)

	messages, err := h.service.ListConversationMessages(c.Request.Context(), conversationID, userID, limit, before)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list messages"})
		return
	}

	c.JSON(http.StatusOK, messages)
}

func (h *Handler) DeleteConversationMessage(c *gin.Context) {
	conversationID := c.Param("id")
	messageID := c.Param("messageId")

	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	if err := h.service.DeleteConversationMessage(c.Request.Context(), conversationID, messageID, userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "message deleted"})
}
