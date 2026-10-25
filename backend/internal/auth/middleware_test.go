package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestMiddlewareRejectsMediaTokenAsBearer(t *testing.T) {
	t.Setenv("JWT_SECRET", "segredo-de-teste")
	gin.SetMode(gin.TestMode)
	s := AuthService(nil)
	router := gin.New()
	router.GET("/x", AuthMiddleware(s), func(c *gin.Context) { c.Status(http.StatusOK) })

	mediaToken, _, err := s.GenerateMediaToken("u1")
	if err != nil {
		t.Fatal(err)
	}
	accessToken, err := s.GenerateAccessToken("u1")
	if err != nil {
		t.Fatal(err)
	}
	for token, want := range map[string]int{mediaToken: http.StatusUnauthorized, accessToken: http.StatusOK} {
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != want {
			t.Fatalf("status = %d, want %d", rec.Code, want)
		}
	}
}
