package message

import "github.com/gin-gonic/gin"

func MessageRoutes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	channels := router.Group("/channels/:channelId/messages")
	channels.Use(authMiddleware)
	{
		channels.POST("", handler.CreateChannelMessage)
		channels.POST("/", handler.CreateChannelMessage)
		channels.GET("", handler.ListChannelMessages)
		channels.GET("/", handler.ListChannelMessages)
		channels.PATCH("/:messageId", handler.EditChannelMessage)
		channels.DELETE("/:messageId", handler.DeleteChannelMessage)
		channels.POST("/:messageId/reactions", handler.AddChannelReaction)
		channels.DELETE("/:messageId/reactions", handler.RemoveChannelReaction)
		channels.PUT("/:messageId/poll/votes", handler.VoteChannelPoll)
		channels.POST("/:messageId/poll/end", handler.EndChannelPoll)
	}

	channelPolls := router.Group("/channels/:channelId/polls")
	channelPolls.Use(authMiddleware)
	{
		channelPolls.POST("", handler.CreateChannelPoll)
		channelPolls.POST("/", handler.CreateChannelPoll)
	}

	conversations := router.Group("/conversations/:id/messages")
	conversations.Use(authMiddleware)
	{
		conversations.POST("", handler.CreateConversationMessage)
		conversations.POST("/", handler.CreateConversationMessage)
		conversations.GET("", handler.ListConversationMessages)
		conversations.GET("/", handler.ListConversationMessages)
		conversations.PATCH("/:messageId", handler.EditConversationMessage)
		conversations.DELETE("/:messageId", handler.DeleteConversationMessage)
		channelsReactions := conversations.Group("/:messageId/reactions")
		{
			channelsReactions.POST("", handler.AddConversationReaction)
			channelsReactions.DELETE("", handler.RemoveConversationReaction)
		}
		conversations.PUT("/:messageId/poll/votes", handler.VoteConversationPoll)
		conversations.POST("/:messageId/poll/end", handler.EndConversationPoll)
	}

	conversationPolls := router.Group("/conversations/:id/polls")
	conversationPolls.Use(authMiddleware)
	{
		conversationPolls.POST("", handler.CreateConversationPoll)
		conversationPolls.POST("/", handler.CreateConversationPoll)
	}
}
