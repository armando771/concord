package channel

import (
	"context"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func ChannelHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

func (h *Handler) Create(c *gin.Context) {
	serverID := c.Param("id")

	var input struct {
		Name string `json:"name"`
		Type string `json:"type"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if input.Type == "" {
		input.Type = TypeText
	}
	if input.Type != TypeText && input.Type != TypeVoice {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type must be text or voice"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	isMember, err := h.service.IsMember(c.Request.Context(), serverID, userID.(string))
	if err != nil || !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not a member of this server"})
		return
	}

	isAdmin, err := h.service.IsAdminOrOwner(c.Request.Context(), serverID, userID.(string))
	if err != nil || !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "only admins can create channels"})
		return
	}

	ch := &Channel{
		ServerID:  serverID,
		Name:      input.Name,
		Type:      input.Type,
		CreatedBy: userID.(string),
	}

	if err := h.service.Create(c.Request.Context(), ch); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, ch)
}

func (h *Handler) ListByServer(c *gin.Context) {
	serverID := c.Param("id")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	isMember, err := h.service.IsMember(c.Request.Context(), serverID, userID.(string))
	if err != nil || !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not a member of this server"})
		return
	}

	channels, err := h.service.ListByServerID(c.Request.Context(), serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list channels"})
		return
	}

	c.JSON(http.StatusOK, channels)
}

func (h *Handler) Update(c *gin.Context) {
	serverID := c.Param("id")
	channelID := c.Param("channelId")

	var input struct {
		Name string `json:"name"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.requireAdmin(c.Request.Context(), serverID, userID.(string)); err != nil {
		c.JSON(err.Status, gin.H{"error": err.Message})
		return
	}

	ch, err := h.service.FindByID(c.Request.Context(), channelID)
	if err != nil || ch.ServerID != serverID {
		c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
		return
	}

	updated, err := h.service.Update(c.Request.Context(), channelID, input.Name)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

func (h *Handler) Delete(c *gin.Context) {
	serverID := c.Param("id")
	channelID := c.Param("channelId")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.requireAdmin(c.Request.Context(), serverID, userID.(string)); err != nil {
		c.JSON(err.Status, gin.H{"error": err.Message})
		return
	}

	ch, err := h.service.FindByID(c.Request.Context(), channelID)
	if err != nil || ch.ServerID != serverID {
		c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
		return
	}

	if err := h.service.Delete(c.Request.Context(), channelID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete channel"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "channel deleted"})
}

// Reorder: PUT /servers/:id/channels/order {type, channel_ids}. Mesma
// permissão de criar/editar/apagar canais (dono ou moderador).
func (h *Handler) Reorder(c *gin.Context) {
	serverID := c.Param("id")

	var input struct {
		Type       string   `json:"type"`
		ChannelIDs []string `json:"channel_ids"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.requireAdmin(c.Request.Context(), serverID, userID.(string)); err != nil {
		c.JSON(err.Status, gin.H{"error": err.Message})
		return
	}

	err := h.service.Reorder(c.Request.Context(), serverID, input.Type, input.ChannelIDs)
	switch {
	case errors.Is(err, ErrInvalidType), errors.Is(err, ErrInvalidOrder):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	case err != nil:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reorder channels"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"type": input.Type, "channel_ids": input.ChannelIDs})
}

type handlerError struct {
	Status  int
	Message string
}

func (h *Handler) requireAdmin(ctx context.Context, serverID string, userID string) *handlerError {
	isMember, err := h.service.IsMember(ctx, serverID, userID)
	if err != nil || !isMember {
		return &handlerError{http.StatusForbidden, "you are not a member of this server"}
	}

	isAdmin, err := h.service.IsAdminOrOwner(ctx, serverID, userID)
	if err != nil || !isAdmin {
		return &handlerError{http.StatusForbidden, "only admins can manage channels"}
	}

	return nil
}