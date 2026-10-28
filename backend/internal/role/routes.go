package role

import "github.com/gin-gonic/gin"

func RoleRoutes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	servers := router.Group("/servers/:id")
	servers.Use(authMiddleware)
	{
		servers.GET("/roles", handler.List)
		servers.POST("/roles", handler.Create)
		servers.PUT("/roles/order", handler.Reorder)
		servers.PATCH("/roles/:roleId", handler.Update)
		servers.DELETE("/roles/:roleId", handler.Delete)
		servers.PUT("/members/:userId/roles/:roleId", handler.AddMemberRole)
		servers.DELETE("/members/:userId/roles/:roleId", handler.RemoveMemberRole)
	}
}
