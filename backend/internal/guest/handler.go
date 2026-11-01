package guest

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// httpErrors: status e código de cada erro do domínio.
var httpErrors = []struct {
	err    error
	status int
	code   string
}{
	{ErrNotFound, http.StatusNotFound, "guest_invite_not_found"},
	{ErrInvalidDuration, http.StatusBadRequest, "invalid_duration"},
	{ErrInvalidName, http.StatusBadRequest, "invalid_name"},
	{ErrNotVoiceChannel, http.StatusBadRequest, "not_voice_channel"},
	{ErrMissingPermission, http.StatusForbidden, "missing_permission"},
	{ErrNotMember, http.StatusForbidden, "not_member"},
	{ErrAccessEnded, http.StatusForbidden, "access_ended"},
	{ErrNotInCall, http.StatusConflict, "not_in_call"},
	{ErrInviteFull, http.StatusConflict, "invite_full"},
	{ErrAlreadyMember, http.StatusConflict, "already_member"},
}

// respondError traduz o erro do domínio; o resto vira 500 sem detalhe.
func respondError(c *gin.Context, err error) {
	for _, e := range httpErrors {
		if errors.Is(err, e.err) {
			c.JSON(e.status, gin.H{"error": e.err.Error(), "code": e.code})
			return
		}
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": "erro interno"})
}

// Preview: a página do link, antes de entrar (pública).
func (h *Handler) Preview(c *gin.Context) {
	preview, err := h.service.Preview(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, preview)
}

// Join: logado entra com a conta; sem login, com o nome digitado.
func (h *Handler) Join(c *gin.Context) {
	if userID := c.GetString("userID"); userID != "" {
		h.joinWithAccount(c, userID)
		return
	}
	var input struct {
		DisplayName string `json:"display_name"`
	}
	_ = c.ShouldBindJSON(&input)
	session, err := h.service.JoinAsGuest(c.Request.Context(), c.Param("id"), input.DisplayName)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, session)
}

func (h *Handler) joinWithAccount(c *gin.Context, userID string) {
	pass, err := h.service.JoinWithAccount(c.Request.Context(), c.Param("id"), userID)
	if errors.Is(err, ErrAlreadyMember) {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error(), "code": "already_member", "server_id": pass.ServerID, "channel_id": pass.ChannelID})
		return
	}
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"pass": pass})
}

// Passes: os acessos ativos de quem chama (conta ou visitante).
func (h *Handler) Passes(c *gin.Context) {
	c.JSON(http.StatusOK, h.service.Passes(c.Request.Context(), c.GetString("userID")))
}

func (h *Handler) Create(c *gin.Context) {
	var input CreateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "pedido inválido"})
		return
	}
	created, err := h.service.CreateInvite(c.Request.Context(), c.GetString("userID"), input)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *Handler) List(c *gin.Context) {
	list, err := h.service.ListInvites(c.Request.Context(), c.GetString("userID"), c.Query("channel_id"))
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *Handler) Revoke(c *gin.Context) {
	if err := h.service.RevokeInvite(c.Request.Context(), c.GetString("userID"), c.Param("id")); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// End expulsa o visitante do servidor (o acesso dele acaba).
func (h *Handler) End(c *gin.Context) {
	var input struct {
		ServerID string `json:"server_id"`
	}
	_ = c.ShouldBindJSON(&input)
	if err := h.service.EndGuest(c.Request.Context(), c.GetString("userID"), input.ServerID, c.Param("userId")); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
