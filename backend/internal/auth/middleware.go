package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func AuthMiddleware(service *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization header required"})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization format"})
			c.Abort()
			return
		}

		claims, err := service.ValidateToken(parts[1])
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			c.Abort()
			return
		}

		if claims.Type != "access" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "token is not an access token"})
			c.Abort()
			return
		}

		c.Set("userID", claims.UserID)
		c.Next()
	}
}

// OptionalAuthMiddleware: para rotas públicas que mostram um pouco mais a quem
// está logado (prévia do convite). Token de acesso válido põe o userID no
// contexto; sem token, ou com token inválido, segue anônimo (nunca recusa).
func OptionalAuthMiddleware(service *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		parts := strings.SplitN(c.GetHeader("Authorization"), " ", 2)
		if len(parts) == 2 && parts[0] == "Bearer" {
			if claims, err := service.ValidateToken(parts[1]); err == nil && claims.Type == "access" {
				c.Set("userID", claims.UserID)
			}
		}
		c.Next()
	}
}
