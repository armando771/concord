package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestLoginWithoutIdentifierIsInvalidCredentials(t *testing.T) {
	gin.SetMode(gin.TestMode)
	// Sem service/userService: não pode nem chegar a procurar a conta.
	h := AuthHandler(nil, nil)
	router := gin.New()
	router.POST("/login", h.Login)

	for _, body := range []string{
		`{"password":"x"}`,
		`{"login":"   ","password":"x"}`,
		`{"login":"@","password":"x"}`,
		`{"email":"","password":"x"}`,
	} {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("%s: status = %d, want 401", body, w.Code)
		}
		if !strings.Contains(w.Body.String(), "invalid credentials") {
			t.Errorf("%s: body = %s, want invalid credentials", body, w.Body.String())
		}
	}
}
