package proposal

import "github.com/gin-gonic/gin"

// ProposalRoutes: criar exige e-mail confirmado (requireVerified); ler e votar não.
func ProposalRoutes(router *gin.RouterGroup, handler *Handler, authMiddleware, requireVerified gin.HandlerFunc) {
	proposals := router.Group("/proposals")
	proposals.Use(authMiddleware)
	{
		proposals.GET("", handler.List)
		proposals.GET("/", handler.List)
		proposals.POST("", requireVerified, handler.Create)
		proposals.PUT("/:id/vote", requireVerified, handler.Vote)
		proposals.DELETE("/:id/vote", handler.RemoveVote)
		proposals.PATCH("/:id/status", handler.SetStatus)
		proposals.DELETE("/:id", handler.Delete)
	}
}
