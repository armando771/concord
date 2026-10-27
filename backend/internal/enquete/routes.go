package enquete

import "github.com/gin-gonic/gin"

func EnqueteRoutes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	router.GET("/users/me/enquetes", authMiddleware, handler.Get)
	router.POST("/users/me/enquetes/:id", authMiddleware, handler.Post)
}
