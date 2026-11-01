package push

import "github.com/gin-gonic/gin"

func Routes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	router.PUT("/push/token", authMiddleware, handler.Put)
	router.DELETE("/push/token", authMiddleware, handler.Delete)
}
