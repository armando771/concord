package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRequireVerified(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tc := range []struct {
		verified bool
		want     int
	}{{true, http.StatusOK}, {false, http.StatusForbidden}} {
		r := gin.New()
		r.POST("/x", func(c *gin.Context) { c.Set("userID", "u1") },
			RequireVerified(func(context.Context, string) (bool, error) { return tc.verified, nil }),
			func(c *gin.Context) { c.Status(http.StatusOK) })
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/x", nil))
		if w.Code != tc.want {
			t.Errorf("verified=%v: status %d, quer %d", tc.verified, w.Code, tc.want)
		}
	}
}
