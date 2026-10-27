package segundoturno

import (
	"context"
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

type estadoSource interface {
	Estado(ctx context.Context, userID string) (Estado, error)
	Responder(ctx context.Context, userID string, fezOL bool) (Estado, error)
}

type Handler struct {
	service estadoSource
}

func SegundoTurnoHandler(service *Service) *Handler {
	return &Handler{service: service}
}

type respostaRequest struct {
	// Ponteiro: "não" é false e precisa se distinguir de campo ausente.
	FezOL *bool `json:"fez_o_l"`
}

// responde traduz o erro de domínio em status HTTP; nil devolve o estado.
func responde(c *gin.Context, estado Estado, err error) {
	switch {
	case err == nil:
		c.JSON(http.StatusOK, estado)
	case errors.Is(err, ErrNaoElegivel):
		c.JSON(http.StatusForbidden, gin.H{"error": "not eligible"})
	case errors.Is(err, ErrJaRespondeu):
		c.JSON(http.StatusConflict, gin.H{"error": "already answered"})
	case errors.Is(err, ErrUsuarioNaoEncontrado):
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
	default:
		log.Printf("[segundoturno] %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process"})
	}
}

func idDeQuemChama(c *gin.Context) (string, bool) {
	v, ok := c.Get("userID")
	id, _ := v.(string)
	if !ok || id == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return "", false
	}
	return id, true
}

// Get: GET /users/me/segundo-turno, se há banner e o que a pessoa respondeu.
func (h *Handler) Get(c *gin.Context) {
	id, ok := idDeQuemChama(c)
	if !ok {
		return
	}
	estado, err := h.service.Estado(c.Request.Context(), id)
	responde(c, estado, err)
}

// Post: POST /users/me/segundo-turno {"fez_o_l": bool}. Resposta única.
func (h *Handler) Post(c *gin.Context) {
	id, ok := idDeQuemChama(c)
	if !ok {
		return
	}
	var req respostaRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.FezOL == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "fez_o_l is required"})
		return
	}
	estado, err := h.service.Responder(c.Request.Context(), id, *req.FezOL)
	responde(c, estado, err)
}
