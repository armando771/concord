package badge

import "github.com/gin-gonic/gin"

func BadgeRoutes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	users := router.Group("/users")
	users.Use(authMiddleware)
	{
		users.GET("/:id/badges", handler.Get)
	}
}
