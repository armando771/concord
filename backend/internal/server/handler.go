package server

import (
	"errors"
	"context"
	"net/http"

	"gin-quickstart/backend/internal/channel"
	"gin-quickstart/backend/internal/friendship"
	"gin-quickstart/backend/internal/user"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service         *Service
	friendService   *friendship.Service
	userService     *user.Service
	channelService  *channel.Service
}

func ServerHandler(service *Service, friendService *friendship.Service, userService *user.Service, channelService *channel.Service) *Handler {
	return &Handler{
		service:        service,
		friendService:  friendService,
		userService:    userService,
		channelService: channelService,
	}
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

	srv, err := h.service.FindByID(c.Request.Context(), serverID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "server not found"})
		return
	}

	if srv.OwnerID != userID.(string) {
		isAdmin, err := h.isAdmin(c.Request.Context(), serverID, userID.(string))
		if err != nil || !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "only admins can edit the server"})
			return
		}
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

func (h *Handler) isAdmin(ctx context.Context, serverID string, userID string) (bool, error) {
	members, err := h.service.ListMembers(ctx, serverID)
	if err != nil {
		return false, err
	}
	for _, m := range members {
		if m.UserID == userID && m.Role == "admin" {
			return true, nil
		}
	}
	return false, nil
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

	c.JSON(http.StatusOK, gin.H{
		"server":  server,
		"members": members,
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

	server, err := h.service.FindByID(c.Request.Context(), serverID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "server not found"})
		return
	}

	// Qualquer membro pode convidar.
	if server.OwnerID != userID.(string) {
		isMember, err := h.service.IsMember(c.Request.Context(), serverID, userID.(string))
		if err != nil || !isMember {
			c.JSON(http.StatusForbidden, gin.H{"error": "you are not a member of this server"})
			return
		}
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

func (h *Handler) SetMemberRole(c *gin.Context) {
	var input struct {
		Role string `json:"role"`
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

	member, err := h.service.SetMemberRole(
		c.Request.Context(), c.Param("id"), userID.(string), c.Param("userId"), input.Role,
	)
	switch {
	case errors.Is(err, ErrOnlyOwner), errors.Is(err, ErrOwnerRole):
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	case errors.Is(err, ErrInvalidRole):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	case errors.Is(err, ErrNotServerMember):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case err != nil:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to change role"})
	default:
		c.JSON(http.StatusOK, member)
	}
}
