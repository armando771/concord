package birthday

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func BirthdayHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

// GetToday: se hoje é aniversário de quem está logado (para o modal) e quais
// servidores já parabenizaram.
func (h *Handler) GetToday(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	today, err := h.service.TodayFor(c.Request.Context(), userID.(string), time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load birthday"})
		return
	}

	c.JSON(http.StatusOK, today)
}
