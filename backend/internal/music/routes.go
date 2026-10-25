package music

import "github.com/gin-gonic/gin"

func Routes(api *gin.RouterGroup, h *Handler, authMiddleware gin.HandlerFunc) {
	g := api.Group("/servers/:id/music")
	g.Use(authMiddleware)
	{
		g.GET("/state", h.State)
		g.GET("/presence", h.Presence)
		g.POST("/pick", h.Pick)
		g.POST("/skip", h.Skip)
		g.DELETE("/queue/:itemId", h.Remove)
		g.POST("/queue/swap", h.Swap)
		g.POST("/video-watch", h.VideoWatch)
	}
	// <video src> não manda Authorization: vale o media token na URL.
	api.GET("/music/video/:itemId", h.Video)
}
