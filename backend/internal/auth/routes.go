package auth

import "github.com/gin-gonic/gin"

func AuthRoutes(router *gin.RouterGroup, handler *Handler, authMiddleware gin.HandlerFunc) {
	auth := router.Group("/auth")
	{
		auth.POST("/register", limitBody(maxLoginBodyBytes), handler.Register)
		auth.POST("/login", limitBody(maxLoginBodyBytes), handler.Login)
		auth.POST("/refresh", handler.Refresh)
		if handler.emails != nil {
			auth.POST("/verify-email", limitBody(maxLoginBodyBytes), handler.VerifyEmail)
			auth.POST("/forgot-password", limitBody(maxLoginBodyBytes), handler.ForgotPassword)
			auth.POST("/reset-password", limitBody(maxLoginBodyBytes), handler.ResetPassword)
		}
	}

	authProtected := router.Group("/auth")
	authProtected.Use(authMiddleware)
	{
		authProtected.POST("/logout", handler.Logout)
		if handler.emails != nil {
			authProtected.POST("/resend-verification", handler.ResendVerification)
		}
	}
}
