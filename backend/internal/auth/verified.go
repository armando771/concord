package auth

import (
	"context"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// CodeEmailNotVerified vai no corpo do 403 para o app mostrar o aviso certo.
const CodeEmailNotVerified = "email_not_verified"

// RequireVerified bloqueia (403) quem ainda não confirmou o e-mail. Vem depois
// do AuthMiddleware. isVerified consulta a conta (user.Service).
func RequireVerified(isVerified func(ctx context.Context, userID string) (bool, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := c.Get("userID")
		userID, _ := id.(string)
		ok, err := isVerified(c.Request.Context(), userID)
		if err != nil {
			log.Printf("[auth] require verified: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
			c.Abort()
			return
		}
		if !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": "email not verified", "code": CodeEmailNotVerified})
			c.Abort()
			return
		}
		c.Next()
	}
}
