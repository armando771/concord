package guest

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// httpWorld: as rotas com auths fakes. O cabeçalho X-User faz o papel do
// token: com ele a pessoa está logada (auth e optionalAuth põem o userID).
func httpWorld(t *testing.T) (*world, *gin.Engine) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := newWorld()
	router := gin.New()
	auth := func(c *gin.Context) {
		id := c.GetHeader("X-User")
		if id == "" {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		c.Set("userID", id)
	}
	optional := func(c *gin.Context) {
		if id := c.GetHeader("X-User"); id != "" {
			c.Set("userID", id)
		}
	}
	Routes(router.Group("/api"), NewHandler(w.svc), Middlewares{Auth: auth, MemberOrGuest: auth, OptionalAuth: optional})
	return w, router
}

func do(router *gin.Engine, method, path, user, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if user != "" {
		req.Header.Set("X-User", user)
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func decode[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("corpo %s: %v", rec.Body.String(), err)
	}
	return v
}

func TestHTTPInviteFlow(t *testing.T) {
	w, router := httpWorld(t)

	rec := do(router, http.MethodPost, "/api/guest-invites", "mod", `{"channel_id":"sala","duration":"6h","can_speak":true}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("criar: %d %s", rec.Code, rec.Body.String())
	}
	created := decode[CreatedInvite](t, rec)

	rec = do(router, http.MethodGet, "/api/guest-invites/"+created.Token, "", "")
	if rec.Code != http.StatusOK || decode[Preview](t, rec).ChannelName != "Sala" {
		t.Fatalf("prévia: %d %s", rec.Code, rec.Body.String())
	}

	// Sem login: entra com o nome e recebe a sessão de visitante.
	rec = do(router, http.MethodPost, "/api/guest-invites/"+created.Token+"/join", "", `{"display_name":"Visita"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("entrar sem conta: %d %s", rec.Code, rec.Body.String())
	}
	sess := decode[Session](t, rec)
	if sess.Token == "" || sess.Pass.ChannelID != "sala" {
		t.Fatalf("sessão = %+v", sess)
	}

	// Logado e membro: 409 com o canal (o app abre o canal normalmente).
	rec = do(router, http.MethodPost, "/api/guest-invites/"+created.Token+"/join", "ana", "")
	body := decode[map[string]string](t, rec)
	if rec.Code != http.StatusConflict || body["code"] != "already_member" || body["channel_id"] != "sala" {
		t.Fatalf("membro: %d %v", rec.Code, body)
	}
	// Logado sem ser membro: entra com a conta.
	rec = do(router, http.MethodPost, "/api/guest-invites/"+created.Token+"/join", "bia", "")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"channel_id":"sala"`) {
		t.Fatalf("conta de fora: %d %s", rec.Code, rec.Body.String())
	}

	rec = do(router, http.MethodGet, "/api/guest/passes", sess.User.ID, "")
	if passes := decode[[]PassView](t, rec); len(passes) != 1 || passes[0].ChannelID != "sala" {
		t.Fatalf("acessos: %s", rec.Body.String())
	}

	rec = do(router, http.MethodGet, "/api/guest-invites?channel_id=sala", "mod", "")
	if list := decode[[]InviteSummary](t, rec); len(list) != 1 || len(list[0].Guests) != 2 {
		t.Fatalf("lista: %s", rec.Body.String())
	}

	rec = do(router, http.MethodPost, "/api/guests/bia/end", "mod", `{"server_id":"srv"}`)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("expulsar: %d %s", rec.Code, rec.Body.String())
	}
	rec = do(router, http.MethodDelete, "/api/guest-invites/"+created.ID, "mod", "")
	if rec.Code != http.StatusNoContent {
		t.Fatalf("revogar: %d %s", rec.Code, rec.Body.String())
	}
	if _, ok := w.svc.GuestChannelPerms(context.Background(), "sala", sess.User.ID); ok {
		t.Fatal("revogar encerra quem entrou")
	}
}

func TestHTTPErrors(t *testing.T) {
	_, router := httpWorld(t)
	cases := []struct {
		name, method, path, user, body string
		status                         int
		code                           string
	}{
		{"link inexistente", http.MethodGet, "/api/guest-invites/" + newToken(), "", "", http.StatusNotFound, "guest_invite_not_found"},
		{"sem permissão", http.MethodPost, "/api/guest-invites", "ana", `{"channel_id":"sala","duration":"2h"}`, http.StatusForbidden, "missing_permission"},
		{"fora da call", http.MethodPost, "/api/guest-invites", "mod", `{"channel_id":"outra","duration":"2h"}`, http.StatusConflict, "not_in_call"},
		{"prazo inválido", http.MethodPost, "/api/guest-invites", "mod", `{"channel_id":"sala","duration":"1h"}`, http.StatusBadRequest, "invalid_duration"},
		{"corpo inválido", http.MethodPost, "/api/guest-invites", "mod", `{`, http.StatusBadRequest, ""},
		{"listar sem permissão", http.MethodGet, "/api/guest-invites?channel_id=sala", "ana", "", http.StatusForbidden, "missing_permission"},
		{"revogar inexistente", http.MethodDelete, "/api/guest-invites/x", "mod", "", http.StatusNotFound, "guest_invite_not_found"},
		{"expulsar quem não é visitante", http.MethodPost, "/api/guests/ana/end", "mod", `{"server_id":"srv"}`, http.StatusNotFound, "guest_invite_not_found"},
		{"criar sem login", http.MethodPost, "/api/guest-invites", "", `{}`, http.StatusUnauthorized, ""},
	}
	for _, tc := range cases {
		rec := do(router, tc.method, tc.path, tc.user, tc.body)
		if rec.Code != tc.status || !strings.Contains(rec.Body.String(), tc.code) {
			t.Errorf("%s: %d %s, want %d %s", tc.name, rec.Code, rec.Body.String(), tc.status, tc.code)
		}
	}
}

func TestHTTPJoinErrorsAndRateLimit(t *testing.T) {
	w, router := httpWorld(t)
	inv := w.invite()
	rec := do(router, http.MethodPost, "/api/guest-invites/"+inv.Token+"/join", "", `{"display_name":"x"}`)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "invalid_name") {
		t.Fatalf("nome inválido: %d %s", rec.Code, rec.Body.String())
	}
	for i := 1; i < joinPerIP; i++ {
		do(router, http.MethodPost, "/api/guest-invites/"+inv.Token+"/join", "", `{"display_name":"x"}`)
	}
	rec = do(router, http.MethodPost, "/api/guest-invites/"+inv.Token+"/join", "", `{"display_name":"Visita"}`)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("depois de %d tentativas: %d, want 429", joinPerIP, rec.Code)
	}
}

func TestRespondErrorHidesUnknownErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	respondError(c, errForTest("senha do banco: xyz"))
	if rec.Code != http.StatusInternalServerError || strings.Contains(rec.Body.String(), "xyz") {
		t.Fatalf("%d %s", rec.Code, rec.Body.String())
	}
}

type errForTest string

func (e errForTest) Error() string { return string(e) }
