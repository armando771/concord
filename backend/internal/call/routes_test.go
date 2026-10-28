package call

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"gin-quickstart/backend/internal/platform/livekit"

	"github.com/gin-gonic/gin"
)

// O visitante sem conta passa só pelas rotas de estar na call: as de
// moderação, convites de amigos e listagem do servidor são só de membros.
func TestGuestTokenReachesOnlyTheCallRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service := serviceWithCall("call-1", "visita")
	service.mediaName = func(context.Context, string) string { return "Visita" }
	service.lookupUser = func(_ context.Context, id string) (UserInfo, error) { return UserInfo{ID: id}, nil }
	handler := CallHandler(service, livekit.NewTokenIssuer("concord", testLiveKitSecret))
	router := gin.New()
	refuseGuest := func(c *gin.Context) { c.AbortWithStatus(http.StatusForbidden) }
	guest := func(c *gin.Context) {
		c.Set("userID", "visita")
		c.Next()
	}
	CallRoutes(router.Group("/api"), handler, refuseGuest, guest)

	cases := []struct {
		method, path string
		open         bool
	}{
		{http.MethodPost, "/api/calls/call-1/token", true},
		{http.MethodGet, "/api/calls/call-1/state", true},
		{http.MethodPost, "/api/calls/move", false},
		{http.MethodGet, "/api/calls/active?scope=server&id=s", false},
		{http.MethodPost, "/api/calls/call-1/invites", false},
		{http.MethodDelete, "/api/calls/call-1/participants/ana", false},
		{http.MethodPost, "/api/calls/call-1/participants/ana/server-mute", false},
	}
	for _, tc := range cases {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest(tc.method, tc.path, nil))
		if refused := rec.Code == http.StatusForbidden; refused == tc.open {
			t.Errorf("%s %s: status %d (aberta ao visitante = %v)", tc.method, tc.path, rec.Code, tc.open)
		}
	}
}
