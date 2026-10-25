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

// ProfileRoutes: edição do perfil (com login) e a mídia do perfil (pública,
// para o <img> e o overlay carregarem sem token).
func ProfileRoutes(router *gin.RouterGroup, handler *ProfileHandler, authMiddleware gin.HandlerFunc) {
	users := router.Group("/users")
	users.Use(authMiddleware)
	{
		users.GET("/:id/profile", handler.GetProfile)
		users.PUT("/me/profile", handler.UpdateProfile)
		users.PUT("/me/status", handler.SetStatus)
		users.POST("/me/avatar", handler.UploadAvatar)
		users.DELETE("/me/avatar", handler.DeleteAvatar)
		users.POST("/me/banner", handler.UploadBanner)
		users.DELETE("/me/banner", handler.DeleteBanner)
	}

	router.GET("/profile-media/:id", handler.ServeMedia)
	router.GET("/profile-media/:id/static", handler.ServeStaticMedia)
}
