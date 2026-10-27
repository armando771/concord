package call

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

// InviteFriends: POST /calls/:id/invites {"user_ids": [...]}.
func (h *Handler) InviteFriends(c *gin.Context) {
	var input struct {
		UserIDs []string `json:"user_ids"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	results, err := h.service.InviteFriends(c.Request.Context(), c.Param("id"), userID.(string), input.UserIDs)
	if err != nil {
		c.JSON(mapInviteError(err), gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"results": results})
}

// AcceptFriendInvite: POST /calls/:id/invites/accept (feito pelo convidado).
func (h *Handler) AcceptFriendInvite(c *gin.Context) {
	h.answerInvite(c, h.service.AcceptFriendInvite)
}

// DeclineFriendInvite: POST /calls/:id/invites/decline (feito pelo convidado).
func (h *Handler) DeclineFriendInvite(c *gin.Context) {
	h.answerInvite(c, h.service.DeclineFriendInvite)
}

func (h *Handler) answerInvite(c *gin.Context, answer func(callID, userID string) error) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	if err := answer(c.Param("id"), userID.(string)); err != nil {
		c.JSON(mapInviteError(err), gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

func mapInviteError(err error) int {
	switch {
	case errors.Is(err, ErrNotFound), errors.Is(err, ErrNoInvite):
		return http.StatusNotFound
	case errors.Is(err, ErrInviteNotAllowed):
		return http.StatusForbidden
	case errors.Is(err, ErrNoInvitees), errors.Is(err, ErrTooManyInvitees), errors.Is(err, ErrNotChannelCall):
		return http.StatusBadRequest
	default:
		return http.StatusInternalServerError
	}
}
