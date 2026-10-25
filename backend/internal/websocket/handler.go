package websocket

import (
	"context"
	"net/http"
	"strings"

	"gin-quickstart/backend/internal/auth"
	"gin-quickstart/backend/internal/channel"
	"gin-quickstart/backend/internal/conversation"
	"gin-quickstart/backend/internal/server"

	"github.com/coder/websocket"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	hub                 *Hub
	authService         *auth.Service
	channelService      *channel.Service
	serverService       *server.Service
	conversationService *conversation.Service
	callRouter          CallRouter
}

func WsHandler(hub *Hub, authService *auth.Service, channelService *channel.Service, serverService *server.Service, conversationService *conversation.Service, callRouter CallRouter) *Handler {
	return &Handler{
		hub:                 hub,
		authService:         authService,
		channelService:      channelService,
		serverService:       serverService,
		conversationService: conversationService,
		callRouter:          callRouter,
	}
}

func (h *Handler) validator(ctx context.Context, userID string, channelID string, conversationID string, serverID string, userRoomID string, callID string) bool {
	if userRoomID != "" {
		return userRoomID == userID
	}

	if serverID != "" {
		isMember, err := h.serverService.IsMember(ctx, serverID, userID)
		if err != nil || !isMember {
			return false
		}
		return true
	}

	if channelID != "" {
		ch, err := h.channelService.FindByID(ctx, channelID)
		if err != nil {
			return false
		}
		isMember, err := h.serverService.IsMember(ctx, ch.ServerID, userID)
		if err != nil || !isMember {
			return false
		}
		return true
	}

	if conversationID != "" {
		isParticipant, err := h.conversationService.IsParticipant(ctx, conversationID, userID)
		if err != nil || !isParticipant {
			return false
		}
		return true
	}

	if callID != "" {
		if h.callRouter == nil {
			return false
		}
		return h.callRouter.IsParticipant(callID, userID)
	}

	return false
}

func (h *Handler) ServeWS(c *gin.Context) {
	token := c.Query("token")
	claims, err := h.authService.ValidateToken(token)
	if err != nil || claims.Type != "access" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	conn, err := websocket.Accept(c.Writer, c.Request, &websocket.AcceptOptions{
		// O app empacotado conecta a partir de file:// (sem host de origem) e a
		// autenticação já é feita pelo ?token=, então a origem não é checada.
		InsecureSkipVerify: true,
	})
	if err != nil {
		return
	}
	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	client := &Client{
		cancel:     cancel,
		hub:        h.hub,
		conn:       conn,
		userID:     claims.UserID,
		send:       make(chan []byte, 32),
		rooms:      make(map[string]struct{}),
		validator:  h.validator,
		callRouter: h.callRouter,
	}

	// Conexão que chegou enquanto o servidor desligava: manda para o processo
	// novo (a checagem e o registro são atômicos no hub).
	if !h.hub.Register(client) {
		_ = conn.Close(CloseServiceRestart, closeRestartReason)
		return
	}

	go client.writePump(ctx)
	client.readPump(ctx)
}

func (h *Handler) Presence(c *gin.Context) {
	raw := c.Query("ids")
	if raw == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ids query is required"})
		return
	}

	ids := strings.Split(raw, ",")
	presence := h.hub.PresenceMap(ids)

	c.JSON(http.StatusOK, presence)
}
