package soundboard

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// apiErr é a resposta de uma etapa que recusou o pedido.
type apiErr struct {
	status int
	body   gin.H
}

func fail(status int, msg string) *apiErr {
	return &apiErr{status: status, body: gin.H{"error": msg}}
}

// currentUser: o usuário autenticado; sem ele já responde 401.
func currentUser(c *gin.Context) (string, bool) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return "", false
	}
	return userID.(string), true
}
