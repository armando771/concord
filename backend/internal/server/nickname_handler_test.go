package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func nicknameRequest(t *testing.T, actor, target, body string) (*httptest.ResponseRecorder, *fakeNicknames) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	n, f := setupNicknames()
	router := gin.New()
	auth := func(c *gin.Context) {
		if actor != "" {
			c.Set("userID", actor)
		}
		c.Next()
	}
	ServerRoutes(router.Group("/api"), &Handler{nicknames: n}, auth)
	req := httptest.NewRequest(http.MethodPut, "/api/servers/s1/members/"+target+"/nickname", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w, f
}

func TestSetNicknameHandler(t *testing.T) {
	cases := []struct {
		name          string
		actor, target string
		body          string
		status        int
		code          string
	}{
		{"sem login", "", "ana", `{"nickname":"x"}`, http.StatusUnauthorized, ""},
		{"json quebrado", "ana", "ana", `{"nickname":`, http.StatusBadRequest, "invalid"},
		{"o próprio", "ana", "ana", `{"nickname":" Aninha "}`, http.StatusOK, ""},
		{"limpar com null", "ana", "ana", `{"nickname":null}`, http.StatusOK, ""},
		{"longo demais", "ana", "ana", `{"nickname":"` + strings.Repeat("a", MaxNickname+1) + `"}`, http.StatusBadRequest, "invalid_nickname"},
		{"outro sem permissão", "ana", "vip", `{"nickname":"x"}`, http.StatusForbidden, "missing_permission"},
		{"cargo acima", "mod", "chefe", `{"nickname":"x"}`, http.StatusForbidden, "role_hierarchy"},
		{"quem não é membro", "mod", "zeca", `{"nickname":"x"}`, http.StatusNotFound, "member_not_found"},
		{"não membro tentando", "zeca", "ana", `{"nickname":"x"}`, http.StatusForbidden, "not_member"},
		{"moderador muda", "mod", "vip", `{"nickname":"VIP"}`, http.StatusOK, ""},
	}
	for _, tc := range cases {
		w, _ := nicknameRequest(t, tc.actor, tc.target, tc.body)
		if w.Code != tc.status {
			t.Errorf("%s: status = %d (%s), want %d", tc.name, w.Code, w.Body.String(), tc.status)
			continue
		}
		var body struct {
			Code string `json:"code"`
		}
		_ = json.Unmarshal(w.Body.Bytes(), &body)
		if body.Code != tc.code {
			t.Errorf("%s: code = %q, want %q", tc.name, body.Code, tc.code)
		}
	}
}

func TestSetNicknameHandlerResponse(t *testing.T) {
	w, f := nicknameRequest(t, "ana", "ana", `{"nickname":"  Aninha  "}`)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	var got NicknameEvent
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.ServerID != "s1" || got.UserID != "ana" || deref(got.Nickname) != "Aninha" {
		t.Fatalf("resposta = %+v", got)
	}
	if len(f.events) != 1 {
		t.Fatalf("eventos = %+v", f.events)
	}

	// Limpar devolve nickname null (o app volta a mostrar o nome de exibição).
	w, _ = nicknameRequest(t, "ana", "ana", `{"nickname":""}`)
	if !strings.Contains(w.Body.String(), `"nickname":null`) {
		t.Fatalf("resposta = %s", w.Body.String())
	}
}
