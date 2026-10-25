package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"gin-quickstart/backend/internal/user"
)

func TestLoginKeyNormalizesIdentifier(t *testing.T) {
	same := [][2]string{{"nicccls", ""}, {"@NICCCLS", ""}, {"  NiCcCls ", ""}, {"", "nicccls"}}
	want := ""
	for _, c := range same {
		id, _ := ParseLoginIdentifier(c[0], c[1])
		key := loginKey(id)
		if want == "" {
			want = key
		} else if key != want {
			t.Errorf("loginKey(%q, %q) = %q, want %q", c[0], c[1], key, want)
		}
	}
	email, _ := ParseLoginIdentifier("Voce@Exemplo.com", "")
	email2, _ := ParseLoginIdentifier("voce@exemplo.COM", "")
	if loginKey(email) != loginKey(email2) {
		t.Error("e-mail com caixa diferente deveria dar a mesma chave")
	}
	if loginKey(email) == want {
		t.Error("e-mail e usuário não podem dividir chave")
	}
}

func TestLoginGuardSuccessResetsIdentifier(t *testing.T) {
	g := newLoginGuard()
	id, _ := ParseLoginIdentifier("nicccls", "")
	for i := 0; i < loginFailuresPerIdentifier-1; i++ {
		g.failed(id)
	}
	g.succeeded(id)
	for i := 0; i < loginFailuresPerIdentifier-1; i++ {
		g.failed(id)
	}
	if _, ok := g.allow("203.0.113.1", &id); !ok {
		t.Fatal("o sucesso deveria ter zerado as falhas anteriores")
	}
	g.failed(id)
	if _, ok := g.allow("203.0.113.2", &id); ok {
		t.Fatal("10 falhas seguidas deveriam bloquear o identificador")
	}
}

// fakeLogins: nenhuma conta existe.
type fakeLogins struct{ calls int }

func (f *fakeLogins) FindLoginByEmail(context.Context, string) (*user.User, error) {
	f.calls++
	return nil, user.ErrLoginNotFound
}

func (f *fakeLogins) FindLoginByUsername(context.Context, string) (*user.User, error) {
	f.calls++
	return nil, user.ErrLoginNotFound
}

func loginRouter(h *Handler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/login", h.Login)
	return router
}

func postLogin(router *gin.Engine, ip, body string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = ip + ":40000"
	router.ServeHTTP(w, req)
	return w
}

func assertTooMany(t *testing.T, w *httptest.ResponseRecorder, retryAfter string) {
	t.Helper()
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429", w.Code)
	}
	if got := w.Header().Get("Retry-After"); got != retryAfter {
		t.Errorf("Retry-After = %q, want %q", got, retryAfter)
	}
	if !strings.Contains(w.Body.String(), "invalid credentials") {
		t.Errorf("body = %s, want a mensagem genérica", w.Body.String())
	}
}

func TestLoginRateLimitsByIP(t *testing.T) {
	h := AuthHandler(nil, nil)
	router := loginRouter(h)

	for i := 0; i < loginAttemptsPerIP; i++ {
		if w := postLogin(router, "203.0.113.1", `{"login":"@","password":"x"}`); w.Code != http.StatusUnauthorized {
			t.Fatalf("tentativa %d: status = %d, want 401", i+1, w.Code)
		}
	}
	assertTooMany(t, postLogin(router, "203.0.113.1", `{"login":"@","password":"x"}`), "300")

	if w := postLogin(router, "203.0.113.2", `{"login":"@","password":"x"}`); w.Code != http.StatusUnauthorized {
		t.Fatalf("outro IP: status = %d, want 401", w.Code)
	}
}

func TestLoginRateLimitsByIdentifier(t *testing.T) {
	h := AuthHandler(nil, nil)
	logins := &fakeLogins{}
	h.logins = logins
	router := loginRouter(h)

	// Mesma conta escrita de jeitos diferentes, de IPs diferentes.
	forms := []string{"nicccls", "@nicccls", "NICCCLS", "@NiCcCls"}
	for i := 0; i < loginFailuresPerIdentifier; i++ {
		body := `{"login":"` + forms[i%len(forms)] + `","password":"errada"}`
		ip := "198.51.100." + string(rune('1'+i%9))
		if w := postLogin(router, ip, body); w.Code != http.StatusUnauthorized {
			t.Fatalf("falha %d: status = %d, want 401", i+1, w.Code)
		}
	}
	calls := logins.calls

	assertTooMany(t, postLogin(router, "192.0.2.50", `{"email":"Nicccls","password":"certa?"}`), "900")
	if logins.calls != calls {
		t.Error("bloqueado não pode nem procurar a conta (nem gastar bcrypt)")
	}

	if w := postLogin(router, "192.0.2.50", `{"login":"outra","password":"x"}`); w.Code != http.StatusUnauthorized {
		t.Errorf("outro identificador: status = %d, want 401", w.Code)
	}
}

func TestLoginBlockExpires(t *testing.T) {
	h := AuthHandler(nil, nil)
	h.logins = &fakeLogins{}
	now := time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)
	h.guard.setClock(func() time.Time { return now })
	router := loginRouter(h)

	for i := 0; i < loginFailuresPerIdentifier; i++ {
		postLogin(router, "198.51.100.1", `{"login":"shaco","password":"x"}`)
	}
	now = now.Add(10 * time.Minute)
	assertTooMany(t, postLogin(router, "198.51.100.2", `{"login":"shaco","password":"x"}`), "300")

	now = now.Add(5 * time.Minute)
	if w := postLogin(router, "198.51.100.2", `{"login":"shaco","password":"x"}`); w.Code != http.StatusUnauthorized {
		t.Fatalf("depois de 15 min: status = %d, want 401", w.Code)
	}
}
