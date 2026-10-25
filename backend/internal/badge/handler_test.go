package badge

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

type fakeSource struct{ called string }

func (f *fakeSource) Badges(_ context.Context, userID string) (Response, error) {
	f.called = userID
	if userID == "00000000-0000-0000-0000-000000000002" {
		return Response{}, ErrUserNotFound
	}
	badges, _ := Evaluate(Stats{CreatedAt: now}, nil, now)
	return Response{UserID: userID, Badges: badges}, nil
}

func serve(t *testing.T, src badgeSource, path string, logged bool) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	auth := func(c *gin.Context) {
		if logged {
			c.Set("userID", "00000000-0000-0000-0000-000000000009")
		}
		c.Next()
	}
	BadgeRoutes(r.Group("/api"), &Handler{service: src}, auth)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
	return w
}

func TestHandlerReturnsBadges(t *testing.T) {
	src := &fakeSource{}
	w := serve(t, src, "/api/users/00000000-0000-0000-0000-000000000001/badges", true)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	var res Response
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if len(res.Badges) != len(Catalog) || res.Badges[0].Tiers[0].Name != "Ouvinte" {
		t.Fatalf("body = %s", w.Body.String())
	}
}

func TestHandlerRejectsBadIDsAndUnknownUsers(t *testing.T) {
	src := &fakeSource{}
	if w := serve(t, src, "/api/users/nope/badges", true); w.Code != http.StatusNotFound {
		t.Fatalf("bad id status = %d", w.Code)
	}
	if src.called != "" {
		t.Fatalf("service called with a bad id")
	}
	if w := serve(t, src, "/api/users/00000000-0000-0000-0000-000000000002/badges", true); w.Code != http.StatusNotFound {
		t.Fatalf("unknown user status = %d", w.Code)
	}
	if w := serve(t, src, "/api/users/00000000-0000-0000-0000-000000000001/badges", false); w.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous status = %d", w.Code)
	}
}
