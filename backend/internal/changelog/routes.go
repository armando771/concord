package changelog

import "github.com/gin-gonic/gin"

// Routes: a leitura exige login; o PUT não usa JWT, só o token do CI.
func Routes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	router.GET("/changelog", authMiddleware, handler.List)
	router.PUT("/changelog/:version", handler.Publish)
}
