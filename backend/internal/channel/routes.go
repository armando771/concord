package channel

import "github.com/gin-gonic/gin"

func ChannelRoutes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	channels := router.Group("/servers/:id/channels")
	channels.Use(authMiddleware)
	{
		channels.POST("", handler.Create)
		channels.POST("/", handler.Create)
		channels.GET("", handler.ListByServer)
		channels.GET("/", handler.ListByServer)
		channels.PUT("", handler.Reorder)
		channels.PUT("/", handler.Reorder)
		channels.PUT("/:channelId", handler.Update)
		channels.DELETE("/:channelId", handler.Delete)
	}
}
