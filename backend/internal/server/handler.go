package server

import (
	"context"
	"errors"
	"net/http"

	"gin-quickstart/backend/internal/channel"
	"gin-quickstart/backend/internal/friendship"
	"gin-quickstart/backend/internal/permission"
	"gin-quickstart/backend/internal/user"

	"github.com/gin-gonic/gin"
)

// PermissionChecker: o membro tem os bits no servidor (permission.Service).
type PermissionChecker interface {
	Require(ctx context.Context, serverID, userID string, want int64) error
}

// RoleLister: cargos do servidor para a resposta de GET /servers/:id.
type RoleLister interface {
	List(ctx context.Context, serverID, userID string) ([]permission.Role, error)
}

type Handler struct {
	service        *Service
	friendService  *friendship.Service
	userService    *user.Service
	channelService *channel.Service
	perms          PermissionChecker
	roles          RoleLister
	moderation     *Moderation
	previews       InvitePreviewer
}

func ServerHandler(service *Service, friendService *friendship.Service, userService *user.Service, channelService *channel.Service, perms PermissionChecker, roles RoleLister, moderation *Moderation) *Handler {
	return &Handler{
		service:        service,
		friendService:  friendService,
		userService:    userService,
		channelService: channelService,
		perms:          perms,
		roles:          roles,
		moderation:     moderation,
		previews:       service,
	}
}

// respondPermission responde os erros de permissão (true se respondeu).
func respondPermission(c *gin.Context, err error) bool {
	if status, code, ok := permission.HTTPError(err); ok {
		c.JSON(status, gin.H{"error": err.Error(), "code": code})
		return true
	}
	return false
}

func (h *Handler) Create(c *gin.Context) {
	var input struct {
		Name    string `json:"name"`
		IconURL string `json:"icon_url"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request",
		})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized",
		})
		return
	}

	server := &Server{
		Name:    input.Name,
		OwnerID: userID.(string),
		IconURL: input.IconURL,
	}

	if err := h.service.Create(c.Request.Context(), server); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	defaultChannel := &channel.Channel{
		ServerID:  server.ID,
		Name:      "geral",
		CreatedBy: userID.(string),
	}
	if err := h.channelService.Create(c.Request.Context(), defaultChannel); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create default channel"})
		return
	}

	c.JSON(http.StatusCreated, server)
}

func (h *Handler) Update(c *gin.Context) {
	serverID := c.Param("id")

	var input struct {
		Name    string `json:"name"`
		IconURL string `json:"icon_url"`
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

	if err := h.perms.Require(c.Request.Context(), serverID, userID.(string), permission.ManageServer); err != nil {
		if !respondPermission(c, err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "server not found"})
		}
		return
	}

	updated, err := h.service.Update(c.Request.Context(), serverID, input.Name, input.IconURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

func (h *Handler) Delete(c *gin.Context) {
	serverID := c.Param("id")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	srv, err := h.service.FindByID(c.Request.Context(), serverID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "server not found"})
		return
	}

	if srv.OwnerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the owner can delete the server"})
		return
	}

	if err := h.service.Delete(c.Request.Context(), serverID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete server"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "server deleted"})
}

// SetPrimaryChannel: dono ou moderador escolhe o canal principal.
func (h *Handler) SetPrimaryChannel(c *gin.Context) {
	serverID := c.Param("id")

	var input struct {
		ChannelID string `json:"channel_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil || input.ChannelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "channel_id is required"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.perms.Require(c.Request.Context(), serverID, userID.(string), permission.ManageServer); err != nil {
		if !respondPermission(c, err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "server not found"})
		}
		return
	}

	updated, err := h.service.SetPrimaryChannel(c.Request.Context(), serverID, input.ChannelID)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, ErrInvalidPrimaryChannel) {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

func (h *Handler) ListByUser(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	servers, err := h.service.ListByUserID(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list servers"})
		return
	}

	c.JSON(http.StatusOK, servers)
}

func (h *Handler) GetByID(c *gin.Context) {
	serverID := c.Param("id")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	isMember, err := h.service.IsMember(c.Request.Context(), serverID, userID.(string))
	if err != nil || !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not a member of this server"})
		return
	}

	server, err := h.service.FindByID(c.Request.Context(), serverID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "server not found"})
		return
	}

	members, err := h.service.ListMembers(c.Request.Context(), serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list members"})
		return
	}

	roles, err := h.roles.List(c.Request.Context(), serverID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list roles"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"server":  server,
		"members": members,
		"roles":   roles,
	})
}

func (h *Handler) InviteMember(c *gin.Context) {
	serverID := c.Param("id")

	var input struct {
		UserID string `json:"user_id"`
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

	// Quem tem CREATE_INVITE (por padrão, todo membro) convida.
	if err := h.perms.Require(c.Request.Context(), serverID, userID.(string), permission.CreateInvite); err != nil {
		if !respondPermission(c, err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "server not found"})
		}
		return
	}

	areFriends, err := h.friendService.AreFriends(c.Request.Context(), userID.(string), input.UserID)
	if err != nil || !areFriends {
		c.JSON(http.StatusBadRequest, gin.H{"error": "you can only invite friends"})
		return
	}

	alreadyMember, err := h.service.IsMember(c.Request.Context(), serverID, input.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check membership"})
		return
	}

	if alreadyMember {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user is already a member"})
		return
	}

	existingInvite, _ := h.service.FindPendingInvite(c.Request.Context(), serverID, input.UserID)
	if existingInvite != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invite already sent"})
		return
	}

	if err := h.service.InviteUser(c.Request.Context(), serverID, userID.(string), input.UserID); err != nil {
		if errors.Is(err, ErrBanned) {
			c.JSON(http.StatusForbidden, gin.H{"error": "esse usuário está banido do servidor", "code": "banned"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to invite user"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "invite sent"})
}

func (h *Handler) ListInvites(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	invites, err := h.service.ListInvitesByInvitee(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list invites"})
		return
	}

	c.JSON(http.StatusOK, invites)
}

func (h *Handler) ListServerInvites(c *gin.Context) {
	serverID := c.Param("id")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	isMember, err := h.service.IsMember(c.Request.Context(), serverID, userID.(string))
	if err != nil || !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not a member of this server"})
		return
	}

	invites, err := h.service.ListInvitesByServer(c.Request.Context(), serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list invites"})
		return
	}

	c.JSON(http.StatusOK, invites)
}

func (h *Handler) AcceptInvite(c *gin.Context) {
	inviteID := c.Param("id")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.service.AcceptInvite(c.Request.Context(), inviteID, userID.(string)); err != nil {
		if errors.Is(err, ErrBanned) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error(), "code": "banned"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "joined server"})
}

func (h *Handler) DeclineInvite(c *gin.Context) {
	inviteID := c.Param("id")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.service.DeclineInvite(c.Request.Context(), inviteID, userID.(string)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "invite declined"})
}

func (h *Handler) InviteCode(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.perms.Require(c.Request.Context(), c.Param("id"), userID.(string), permission.CreateInvite); err != nil {
		if !respondPermission(c, err) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get invite code"})
		}
		return
	}

	code, err := h.service.InviteCode(c.Request.Context(), c.Param("id"), userID.(string))
	if errors.Is(err, ErrNotServerMember) {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get invite code"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": code})
}

func (h *Handler) JoinByCode(c *gin.Context) {
	var input struct {
		Code string `json:"code"`
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

	server, err := h.service.JoinByCode(c.Request.Context(), input.Code, userID.(string))
	if errors.Is(err, ErrBanned) {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error(), "code": "banned"})
		return
	}
	if errors.Is(err, ErrInvalidCode) {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to join server"})
		return
	}

	c.JSON(http.StatusOK, server)
}
