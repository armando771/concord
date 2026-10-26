package call

import "github.com/gin-gonic/gin"

func CallRoutes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	calls := router.Group("/calls")
	calls.Use(authMiddleware)
	{
		calls.POST("", handler.Create)
		calls.POST("/move", handler.Move)
		calls.GET("/active", handler.Active)
		calls.GET("/:id/state", handler.State)
		calls.POST("/:id/token", handler.Token)
		calls.PUT("/:id/screen-preview", handler.PutScreenPreview)
		calls.GET("/:id/screen-preview/:userId", handler.GetScreenPreview)
		calls.DELETE("/:id", handler.Delete)
		calls.POST("/:id/participants/:userId/server-mute", handler.ServerMute)
		calls.POST("/:id/participants/:userId/server-deafen", handler.ServerDeafen)
		calls.DELETE("/:id/participants/:userId", handler.Disconnect)
	}
}
