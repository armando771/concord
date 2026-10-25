package proposal

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	service *Service
}

func ProposalHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) fail(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "proposal not found"})
	case errors.Is(err, ErrInvalidTitle):
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid title"})
	case errors.Is(err, ErrInvalidDescription):
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid description"})
	case errors.Is(err, ErrInvalidStatus):
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
	case errors.Is(err, ErrTooManyOpen):
		c.JSON(http.StatusConflict, gin.H{"error": "too many open proposals", "code": "too_many_open"})
	case errors.Is(err, ErrVotingClosed):
		c.JSON(http.StatusConflict, gin.H{"error": "voting closed", "code": "voting_closed"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
	default:
		log.Printf("[proposal] %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
	}
}

// proposalID lê e valida :id; responde 400 e devolve false se for inválido.
func proposalID(c *gin.Context) (string, bool) {
	id := c.Param("id")
	if _, err := uuid.Parse(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid proposal id"})
		return "", false
	}
	return id, true
}

func (h *Handler) List(c *gin.Context) {
	board, err := h.service.Board(c.Request.Context(), c.GetString("userID"))
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, board)
}

func (h *Handler) Create(c *gin.Context) {
	var body struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	p, err := h.service.Create(c.Request.Context(), c.GetString("userID"), body.Title, body.Description)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, p)
}

func (h *Handler) Vote(c *gin.Context) {
	id, ok := proposalID(c)
	if !ok {
		return
	}
	var body struct {
		Approve *bool `json:"approve"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Approve == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	p, err := h.service.Vote(c.Request.Context(), id, c.GetString("userID"), *body.Approve)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *Handler) RemoveVote(c *gin.Context) {
	id, ok := proposalID(c)
	if !ok {
		return
	}
	p, err := h.service.RemoveVote(c.Request.Context(), id, c.GetString("userID"))
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *Handler) SetStatus(c *gin.Context) {
	id, ok := proposalID(c)
	if !ok {
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	p, err := h.service.SetStatus(c.Request.Context(), id, c.GetString("userID"), body.Status)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *Handler) Delete(c *gin.Context) {
	id, ok := proposalID(c)
	if !ok {
		return
	}
	if err := h.service.Delete(c.Request.Context(), id, c.GetString("userID")); err != nil {
		h.fail(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
