package notifysettings

import "github.com/gin-gonic/gin"

func Routes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	router.GET("/users/me/notification-settings", authMiddleware, handler.Get)
	router.PUT("/servers/:id/notification-settings", authMiddleware, handler.SetServer)
	router.PUT("/servers/:id/channels/:channelId/notification-settings", authMiddleware, handler.SetChannel)
}
