package main

import (
	"gin-quickstart/backend/internal/message"

	"github.com/gin-gonic/gin"
)

// wireTTS: mensagens /tts (docs/adr/0012-tts-no-cliente.md). Depende do
// roomAccess montado pelo wireChat.
func (a *app) wireTTS(messageRepository *message.Repository) {
	tts := message.NewTTSService(messageRepository, a.hub, a.channelRepository, a.conversationRepository)
	handler := message.NewTTSHandler(tts, a.permissionService, a.roomAccess)
	a.route(func(_ *gin.Engine, api *gin.RouterGroup) {
		message.TTSRoutes(api, handler, a.authMiddleware)
	})
}
