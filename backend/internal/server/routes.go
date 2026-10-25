package server

import "github.com/gin-gonic/gin"

func ServerRoutes(router *gin.RouterGroup, handler *Handler, authMiddleware, requireVerified gin.HandlerFunc) {
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
		servers.POST("/:id/invite", requireVerified, handler.InviteMember)
		servers.GET("/:id/invites", handler.ListServerInvites)
		servers.GET("/:id/invite-code", handler.InviteCode)
		servers.DELETE("/:id/members/:userId", handler.Kick)
		servers.PUT("/:id/members/:userId/nickname", handler.SetNickname)
		servers.POST("/:id/leave", handler.Leave)
		servers.GET("/:id/bans", handler.ListBans)
		servers.POST("/:id/bans", handler.Ban)
		servers.DELETE("/:id/bans/:userId", handler.Unban)
		servers.PUT("/:id/primary-channel", handler.SetPrimaryChannel)
	}

	invites := router.Group("/invites")
	invites.Use(authMiddleware)
	{
		invites.GET("", handler.ListInvites)
		invites.GET("/", handler.ListInvites)
		invites.POST("/join", requireVerified, handler.JoinByCode)
		invites.POST("/:id/accept", requireVerified, handler.AcceptInvite)
		invites.POST("/:id/decline", handler.DeclineInvite)
	}
}
