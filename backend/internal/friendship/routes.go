package friendship

import "github.com/gin-gonic/gin"

func FriendRoutes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	friends := router.Group("/friends")
	friends.Use(authMiddleware)
	{
		friends.POST("/request", handler.SendRequest)
		friends.DELETE("/request/:username", handler.CancelRequest)
		friends.GET("", handler.ListFriends)
		friends.GET("/", handler.ListFriends)
		friends.GET("/pending", handler.ListPending)
		friends.GET("/blocked", handler.ListBlocked)
		friends.PUT("/:username/accept", handler.AcceptRequest)
		friends.PUT("/:username/decline", handler.DeclineRequest)
		friends.DELETE("/:username", handler.RemoveFriend)
	}

	users := router.Group("/users")
	users.Use(authMiddleware)
	{
		users.GET("/:id/relationship", handler.Relationship)
		users.PUT("/:id/block", handler.Block)
		users.DELETE("/:id/block", handler.Unblock)
	}
}
