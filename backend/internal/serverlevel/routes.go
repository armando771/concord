package serverlevel

import "github.com/gin-gonic/gin"

func Routes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	servers := router.Group("/servers")
	servers.Use(authMiddleware)
	servers.GET("/:id/level", handler.Get)
}
