package call

import (
	"errors"
	"net/http"

	"gin-quickstart/backend/internal/livekit"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
	tokens  *livekit.TokenIssuer
}

func CallHandler(service *Service, tokens *livekit.TokenIssuer) *Handler {
	return &Handler{
		service: service,
		tokens:  tokens,
	}
}

func (h *Handler) Create(c *gin.Context) {
	var input struct {
		Type           string `json:"type"`
		ConversationID string `json:"conversation_id"`
		ChannelID      string `json:"channel_id"`
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

	ctx := c.Request.Context()

	switch input.Type {
	case TypeDM:
		if input.ConversationID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "conversation_id is required"})
			return
		}
		call, err := h.service.StartDM(ctx, userID.(string), input.ConversationID)
		if err != nil {
			c.JSON(mapStartError(err), gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, call)
	case TypeChannel:
		if input.ChannelID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "channel_id is required"})
			return
		}
		call, err := h.service.StartChannel(ctx, userID.(string), input.ChannelID)
		if err != nil {
			c.JSON(mapStartError(err), gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, call)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": ErrInvalidType.Error()})
	}
}

func (h *Handler) Active(c *gin.Context) {
	scope := c.Query("scope")
	id := c.Query("id")

	if scope != TypeDM && scope != TypeChannel && scope != "server" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "scope must be dm, channel or server"})
		return
	}
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id query is required"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	ctx := c.Request.Context()

	if scope == TypeDM {
		isParticipant, err := h.service.conversationService.IsParticipant(ctx, id, userID.(string))
		if err != nil || !isParticipant {
			c.JSON(http.StatusForbidden, gin.H{"error": ErrNotParticipant.Error()})
			return
		}
	} else if scope == "server" {
		isMember, err := h.service.serverService.IsMember(ctx, id, userID.(string))
		if err != nil || !isMember {
			c.JSON(http.StatusForbidden, gin.H{"error": ErrNotMember.Error()})
			return
		}

		states, err := h.service.ListActiveByServer(ctx, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list active calls"})
			return
		}

		// Só os canais de voz que a pessoa vê.
		c.JSON(http.StatusOK, h.service.VisibleStates(ctx, id, userID.(string), states))
		return
	} else {
		ch, err := h.service.channelService.FindByID(ctx, id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
			return
		}
		if !h.service.CanViewChannel(ctx, ch.ID, userID.(string)) {
			c.JSON(http.StatusForbidden, gin.H{"error": ErrNotMember.Error()})
			return
		}
	}

	call, err := h.service.FindActiveByScope(scope, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": ErrNotFound.Error()})
		return
	}

	state, err := h.service.GetState(ctx, call.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load call state"})
		return
	}

	c.JSON(http.StatusOK, state)
}

func (h *Handler) State(c *gin.Context) {
	callID := c.Param("id")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	state, err := h.service.GetState(c.Request.Context(), callID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": ErrNotFound.Error()})
		return
	}

	allowed := false
	for _, p := range state.Participants {
		if p.UserID == userID.(string) {
			allowed = true
			break
		}
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": ErrNotAllowed.Error()})
		return
	}

	c.JSON(http.StatusOK, state)
}

func (h *Handler) Delete(c *gin.Context) {
	callID := c.Param("id")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.service.EndByUser(c.Request.Context(), callID, userID.(string)); err != nil {
		status := http.StatusInternalServerError
		switch {
		case errors.Is(err, ErrNotFound):
			status = http.StatusNotFound
		case errors.Is(err, ErrNotAllowed):
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "call ended"})
}

// Token emite o JWT do LiveKit para a sala da chamada. Só participantes
// (quem já aceitou/entrou pelo fluxo call:*) recebem token.
func (h *Handler) Token(c *gin.Context) {
	callID := c.Param("id")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if !h.service.IsParticipant(callID, userID.(string)) {
		c.JSON(http.StatusForbidden, gin.H{"error": ErrNotAllowed.Error()})
		return
	}

	// O nome vai no token para quem está só na mídia (fora da lista do
	// backend, ex.: queda do WS) aparecer com nome e não como "Usuário".
	name := h.service.mediaName(c.Request.Context(), userID.(string))

	token, err := h.tokens.Issue(callID, userID.(string), name, h.service.GrantFor(c.Request.Context(), callID, userID.(string)))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to issue media token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token})
}

// Move: um moderador tira alguém do canal de voz em que está e o põe em
// outro canal de voz do mesmo servidor.
func (h *Handler) Move(c *gin.Context) {
	var input struct {
		UserID    string `json:"user_id"`
		ChannelID string `json:"channel_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil || input.UserID == "" || input.ChannelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id and channel_id are required"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	call, err := h.service.MoveToChannel(c.Request.Context(), userID.(string), input.UserID, input.ChannelID)
	if err != nil {
		c.JSON(mapMoveError(err), gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, call)
}

func mapMoveError(err error) int {
	switch {
	case errors.Is(err, ErrNotModerator), errors.Is(err, ErrCannotMoveOwner), errors.Is(err, ErrCannotActOnMember), errors.Is(err, ErrTargetCannotJoin):
		return http.StatusForbidden
	case errors.Is(err, ErrNotInVoice), errors.Is(err, ErrSameChannel), errors.Is(err, ErrNotVoiceChannel):
		return http.StatusBadRequest
	default:
		return mapStartError(err)
	}
}

func mapStartError(err error) int {
	switch {
	case errors.Is(err, ErrNotFound):
		return http.StatusNotFound
	case errors.Is(err, ErrBusy),
		errors.Is(err, ErrCalleeOffline),
		errors.Is(err, ErrNotParticipant),
		errors.Is(err, ErrBlocked),
		errors.Is(err, ErrNotMember),
		errors.Is(err, ErrInvalidType):
		return http.StatusBadRequest
	case errors.Is(err, ErrNoConnect):
		return http.StatusForbidden
	default:
		return http.StatusInternalServerError
	}
}

// respondModeration traduz os erros das ações de moderação de voz.
func respondModeration(c *gin.Context, err error) {
	status, code := http.StatusInternalServerError, "internal"
	switch {
	case errors.Is(err, ErrMissingPermission):
		status, code = http.StatusForbidden, "missing_permission"
	case errors.Is(err, ErrCannotActOnMember):
		status, code = http.StatusForbidden, "role_hierarchy"
	case errors.Is(err, ErrNotMember):
		status, code = http.StatusForbidden, "not_member"
	case errors.Is(err, ErrNotFound), errors.Is(err, ErrTargetNotInCall):
		status, code = http.StatusNotFound, "not_found"
	case errors.Is(err, ErrNotChannelCall):
		status, code = http.StatusBadRequest, "invalid"
	}
	msg := err.Error()
	if status == http.StatusInternalServerError {
		msg = "internal error"
	}
	c.JSON(status, gin.H{"error": msg, "code": code})
}

// ServerMute: POST /calls/:id/participants/:userId/server-mute {muted}.
func (h *Handler) ServerMute(c *gin.Context) {
	h.serverVoice(c, func(ctx *gin.Context, actor string, on bool) error {
		return h.service.SetServerMute(ctx.Request.Context(), ctx.Param("id"), actor, ctx.Param("userId"), on)
	})
}

// ServerDeafen: POST /calls/:id/participants/:userId/server-deafen {deafened}.
func (h *Handler) ServerDeafen(c *gin.Context) {
	h.serverVoice(c, func(ctx *gin.Context, actor string, on bool) error {
		return h.service.SetServerDeafen(ctx.Request.Context(), ctx.Param("id"), actor, ctx.Param("userId"), on)
	})
}

func (h *Handler) serverVoice(c *gin.Context, apply func(*gin.Context, string, bool) error) {
	var input struct {
		Muted    *bool `json:"muted"`
		Deafened *bool `json:"deafened"`
	}
	if err := c.ShouldBindJSON(&input); err != nil || (input.Muted == nil && input.Deafened == nil) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	on := false
	if input.Muted != nil {
		on = *input.Muted
	} else {
		on = *input.Deafened
	}
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	if err := apply(c, userID.(string), on); err != nil {
		respondModeration(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// Disconnect: DELETE /calls/:id/participants/:userId (MOVE_MEMBERS).
func (h *Handler) Disconnect(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	if err := h.service.DisconnectParticipant(c.Request.Context(), c.Param("id"), userID.(string), c.Param("userId")); err != nil {
		respondModeration(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
