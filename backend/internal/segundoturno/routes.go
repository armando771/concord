package segundoturno

import "github.com/gin-gonic/gin"

func SegundoTurnoRoutes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	router.GET("/users/me/segundo-turno", authMiddleware, handler.Get)
	router.POST("/users/me/segundo-turno", authMiddleware, handler.Post)
}
