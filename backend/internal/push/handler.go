package push

import (
	"context"
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

type tokenService interface {
	Register(ctx context.Context, userID, token, platform string) error
	Unregister(ctx context.Context, userID, token string) error
}

type Handler struct{ service tokenService }

func PushHandler(s tokenService) *Handler { return &Handler{service: s} }

type tokenBody struct {
	Token    string `json:"token"`
	Platform string `json:"platform"`
}

func (h *Handler) Put(c *gin.Context) {
	var body tokenBody
	if !bindBody(c, &body) {
		return
	}
	if body.Platform == "" {
		body.Platform = platformAndroid
	}
	h.respond(c, h.service.Register(c.Request.Context(), c.GetString("userID"), body.Token, body.Platform))
}

func (h *Handler) Delete(c *gin.Context) {
	var body tokenBody
	if !bindBody(c, &body) {
		return
	}
	h.respond(c, h.service.Unregister(c.Request.Context(), c.GetString("userID"), body.Token))
}

func bindBody(c *gin.Context, body *tokenBody) bool {
	if c.GetString("userID") == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "não autenticado"})
		return false
	}
	if err := c.ShouldBindJSON(body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "corpo inválido"})
		return false
	}
	return true
}

func (h *Handler) respond(c *gin.Context, err error) {
	switch {
	case err == nil:
		c.Status(http.StatusNoContent)
	case errors.Is(err, ErrInvalidToken):
		c.JSON(http.StatusBadRequest, gin.H{"error": "token inválido"})
	default:
		log.Printf("[push] token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro interno"})
	}
}
