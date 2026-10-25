package server

import "github.com/gin-gonic/gin"

func ServerRoutes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	servers := router.Group("/servers")
	servers.Use(authMiddleware)
	{
		servers.POST("", handler.Create)
		servers.POST("/", handler.Create)
		servers.GET("", handler.ListByUser)
		servers.GET("/", handler.ListByUser)
		servers.GET("/:id", handler.GetByID)
		servers.PUT("/:id", handler.Update)
		servers.DELETE("/:id", handler.Delete)
		servers.POST("/:id/invite", handler.InviteMember)
		servers.GET("/:id/invites", handler.ListServerInvites)
		servers.GET("/:id/invite-code", handler.InviteCode)
		servers.PUT("/:id/members/:userId/role", handler.SetMemberRole)
		servers.PUT("/:id/primary-channel", handler.SetPrimaryChannel)
	}

	invites := router.Group("/invites")
	invites.Use(authMiddleware)
	{
		invites.GET("", handler.ListInvites)
		invites.GET("/", handler.ListInvites)
		invites.POST("/join", handler.JoinByCode)
		invites.POST("/:id/accept", handler.AcceptInvite)
		invites.POST("/:id/decline", handler.DeclineInvite)
	}
}
