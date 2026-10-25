package birthday

import "github.com/gin-gonic/gin"

func BirthdayRoutes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	birthdays := router.Group("/birthdays")
	birthdays.Use(authMiddleware)
	{
		birthdays.GET("/today", handler.GetToday)
	}
}
