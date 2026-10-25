package user

import "github.com/gin-gonic/gin"

func UserRoutes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	users := router.Group("/users")
	users.Use(authMiddleware)
	{
		users.GET("/me", handler.GetMe)
		users.GET("/me/birthday", handler.GetBirthday)
		users.PUT("/me/birthday", handler.SetBirthday)
		users.GET("/search", handler.SearchUsers)
	}
}
