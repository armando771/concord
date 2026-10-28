package call

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gin-quickstart/backend/internal/platform/livekit"

	"github.com/gin-gonic/gin"
	"github.com/livekit/protocol/auth"
)

const testLiveKitSecret = "segredo-de-teste-com-tamanho-suficiente-123"

// tokenRouter monta só a rota de token, com um "auth" fake que injeta o userID.
func tokenRouter(service *Service, userID string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	handler := CallHandler(service, livekit.NewTokenIssuer("concord", testLiveKitSecret))
	router := gin.New()
	fakeAuth := func(c *gin.Context) {
		c.Set("userID", userID)
		c.Next()
	}
	CallRoutes(router.Group("/api"), handler, fakeAuth, fakeAuth)
	return router
}

func serviceWithCall(callID string, participantIDs ...string) *Service {
	service := CallService(nil, nil, nil, nil, nil, nil, nil)
	ac := &activeCall{
		info:         &Call{ID: callID, Type: TypeChannel, Status: StatusActive},
		participants: make(map[string]*participantState),
	}
	for _, id := range participantIDs {
		ac.participants[id] = &participantState{userID: id, role: RoleMember}
	}
	service.calls[callID] = ac
	return service
}

func TestTokenForParticipantJoinsCallRoom(t *testing.T) {
	service := serviceWithCall("call-1", "user-1")
	service.mediaName = func(context.Context, string) string { return "Ana" }
	router := tokenRouter(service, "user-1")

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/calls/call-1/token", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var body struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil || body.Token == "" {
		t.Fatalf("invalid body %s: %v", rec.Body.String(), err)
	}
	verifier, err := auth.ParseAPIToken(body.Token)
	if err != nil {
		t.Fatalf("ParseAPIToken: %v", err)
	}
	_, grants, err := verifier.Verify(testLiveKitSecret)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if grants.Identity != "user-1" || grants.Video.Room != "call-1" {
		t.Fatalf("identity=%q room=%q, want user-1/call-1", grants.Identity, grants.Video.Room)
	}
	// Quem fica só na mídia (fora da lista do backend) aparece pelo nome do token.
	if grants.Name != "Ana" {
		t.Fatalf("name=%q, want Ana", grants.Name)
	}
}

func TestTokenForNonParticipantIsForbidden(t *testing.T) {
	router := tokenRouter(serviceWithCall("call-1", "user-1"), "intruso")

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/calls/call-1/token", nil))

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
}

func TestTokenForUnknownCallIsForbidden(t *testing.T) {
	router := tokenRouter(serviceWithCall("call-1", "user-1"), "user-1")

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/calls/nao-existe/token", nil))

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
}
