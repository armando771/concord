package level

import "github.com/gin-gonic/gin"

func LevelRoutes(router *gin.RouterGroup, handler *Handler, ranking *RankingHandler, authMiddleware gin.HandlerFunc) {
	levels := router.Group("/levels")
	levels.Use(authMiddleware)
	{
		levels.GET("", handler.List)
		levels.GET("/", handler.List)
		levels.GET("/me", handler.GetMe)
		levels.GET("/ranking", ranking.Get)
	}
}
