package serverlevel

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// MemberChecker diz se a pessoa é membro do servidor (server.Service).
type MemberChecker interface {
	IsMember(ctx context.Context, serverID, userID string) (bool, error)
}

type detailer interface {
	Detail(ctx context.Context, serverID string) (Detail, error)
}

type Handler struct {
	service detailer
	members MemberChecker
}

func NewHandler(service detailer, members MemberChecker) *Handler {
	return &Handler{service: service, members: members}
}

// Get devolve o nível do servidor com o detalhamento da semana (só membros).
func (h *Handler) Get(c *gin.Context) {
	serverID := c.Param("id")
	if _, err := uuid.Parse(serverID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid server id"})
		return
	}
	ctx := c.Request.Context()
	if ok, err := h.members.IsMember(ctx, serverID, c.GetString("userID")); err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not a member of this server"})
		return
	}
	detail, err := h.service.Detail(ctx, serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load server level"})
		return
	}
	c.JSON(http.StatusOK, detail)
}
