package server

import (
	"context"
	"errors"
	"net/http"
	"time"

	"gin-quickstart/backend/internal/ratelimit"
	"gin-quickstart/backend/internal/user"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

// Limite da prévia do convite (pública, sem login): por IP, em memória.
const (
	invitePreviewPerIP   = 60
	invitePreviewWindow  = time.Minute
	invitePreviewMaxKeys = 10000
)

// InvitePreview é o que a página do link de convite mostra antes de entrar,
// para quem nem tem conta: nada de e-mail, dono ou lista de membros. O id do
// servidor vai para o app saber se a pessoa já está nele e abrir o servidor.
type InvitePreview struct {
	ServerID    string  `json:"server_id"`
	Name        string  `json:"name"`
	IconURL     *string `json:"icon_url,omitempty"`
	MemberCount int     `json:"member_count"`
	OnlineCount int     `json:"online_count"`
}

// InvitePreviewer: a prévia de um código (Service.InvitePreview).
type InvitePreviewer interface {
	InvitePreview(ctx context.Context, code string) (*InvitePreview, error)
}

// PresenceLookup devolve o status que os outros veem de cada id
// (websocket.Hub.PresenceMap: "offline" se desconectado ou invisível).
type PresenceLookup func(userIDs []string) map[string]string

// validInviteCode: só o formato que newInviteCode gera (e um pouco de folga),
// já normalizado. O resto nem chega ao banco.
func validInviteCode(code string) bool {
	if len(code) < 4 || len(code) > 16 {
		return false
	}
	for _, r := range code {
		if (r < 'A' || r > 'Z') && (r < '0' || r > '9') {
			return false
		}
	}
	return true
}

// countOnline conta quem os outros veem como online (invisível não conta).
func countOnline(userIDs []string, presence PresenceLookup) int {
	if presence == nil || len(userIDs) == 0 {
		return 0
	}
	online := 0
	for _, status := range presence(userIDs) {
		if status != user.StatusOffline {
			online++
		}
	}
	return online
}

// SetPresence liga a contagem de online da prévia do convite.
func (s *Service) SetPresence(presence PresenceLookup) {
	s.presence = presence
}

// InvitePreview: servidor do código, com membros e online. Código malformado
// ou que não existe é ErrInvalidCode.
func (s *Service) InvitePreview(ctx context.Context, rawCode string) (*InvitePreview, error) {
	code := normalizeInviteCode(rawCode)
	if !validInviteCode(code) {
		return nil, ErrInvalidCode
	}
	preview, memberIDs, err := s.repository.InvitePreview(ctx, code)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrInvalidCode
	}
	if err != nil {
		return nil, err
	}
	preview.MemberCount = len(memberIDs)
	preview.OnlineCount = countOnline(memberIDs, s.presence)
	return preview, nil
}

// InvitePreview responde GET /invites/:id/preview (o :id é o código; o nome
// do parâmetro tem que ser o mesmo das outras rotas de /invites no gin).
func (h *Handler) InvitePreview(c *gin.Context) {
	preview, err := h.previews.InvitePreview(c.Request.Context(), c.Param("id"))
	if errors.Is(err, ErrInvalidCode) {
		c.JSON(http.StatusNotFound, gin.H{"error": "convite inválido ou expirado"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load invite"})
		return
	}
	c.JSON(http.StatusOK, preview)
}

// limitByIP: no máximo o limite do limiter por IP (IPv6 por /64); passou, 429
// com Retry-After.
func limitByIP(limiter *ratelimit.Limiter, message string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if retry, ok := limiter.Allow(ratelimit.IPKey(c.ClientIP())); !ok {
			c.Header("Retry-After", ratelimit.RetryAfterSeconds(retry))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": message})
			return
		}
		c.Next()
	}
}
