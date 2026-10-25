package notifysettings

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"gin-quickstart/backend/internal/permission"
)

type Handler struct {
	service *Service
}

func NotifySettingsHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) fail(c *gin.Context, err error) {
	if errors.Is(err, ErrInvalidSettings) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid notification settings"})
		return
	}
	if status, code, ok := permission.HTTPError(err); ok {
		c.JSON(status, gin.H{"error": err.Error(), "code": code})
		return
	}
	log.Printf("[notifysettings] %v", err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
}

func validID(c *gin.Context, param string) (string, bool) {
	id := c.Param(param)
	if _, err := uuid.Parse(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid " + param})
		return "", false
	}
	return id, true
}

// Get: GET /users/me/notification-settings
func (h *Handler) Get(c *gin.Context) {
	all, err := h.service.All(c.Request.Context(), c.GetString("userID"))
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, all)
}

// SetServer: PUT /servers/:id/notification-settings
func (h *Handler) SetServer(c *gin.Context) {
	serverID, ok := validID(c, "id")
	if !ok {
		return
	}
	var in Settings
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	out, err := h.service.SetServer(c.Request.Context(), c.GetString("userID"), serverID, in)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, out)
}

// SetChannel: PUT /servers/:id/channels/:channelId/notification-settings
func (h *Handler) SetChannel(c *gin.Context) {
	if _, ok := validID(c, "id"); !ok {
		return
	}
	channelID, ok := validID(c, "channelId")
	if !ok {
		return
	}
	var in Settings
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	out, err := h.service.SetChannel(c.Request.Context(), c.GetString("userID"), channelID, in)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, out)
}
