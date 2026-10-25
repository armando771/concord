package message

import "github.com/gin-gonic/gin"

func AttachmentRoutes(router *gin.RouterGroup, h *AttachmentHandler, authMiddleware gin.HandlerFunc) {
	channels := router.Group("/channels/:channelId/attachments")
	channels.Use(authMiddleware)
	{
		channels.POST("", h.UploadToChannel)
		channels.POST("/", h.UploadToChannel)
	}

	conversations := router.Group("/conversations/:id/attachments")
	conversations.Use(authMiddleware)
	{
		conversations.POST("", h.UploadToConversation)
		conversations.POST("/", h.UploadToConversation)
	}
}
