package auth

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"gin-quickstart/backend/internal/user"
)

type fakeAccounts struct {
	availableErr error
	err          error
	created      *user.User
	checks       int
}

func (f *fakeAccounts) CheckAvailable(context.Context, string, string) error {
	f.checks++
	return f.availableErr
}

func (f *fakeAccounts) Create(_ context.Context, u *user.User) error {
	f.created = u
	return f.err
}

func (f *fakeAccounts) SetBirthday(context.Context, string, user.Birthday) error { return nil }

// registerHandler: hash contado (sem bcrypt de verdade) e relógio fixo.
func registerHandler(accounts *fakeAccounts) (*Handler, *int) {
	h := AuthHandler(nil, nil)
	h.accounts = accounts
	hashes := 0
	h.hashPassword = func(pw []byte) ([]byte, error) {
		hashes++
		return []byte("hash"), nil
	}
	h.registerByIP.SetClock(func() time.Time { return fixedNow })
	return h, &hashes
}

func postRegisterFrom(h *Handler, ip, body string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/register", h.Register)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/register", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = ip + ":40000"
	router.ServeHTTP(w, req)
	return w
}

func postRegister(h *Handler, body string) *httptest.ResponseRecorder {
	return postRegisterFrom(h, "192.0.2.1", body)
}

func TestRegisterValidatesBeforeTouchingTheDatabase(t *testing.T) {
	accounts := &fakeAccounts{}
	h, hashes := registerHandler(accounts)
	for _, body := range []string{
		`{"username":"a@b","display_name":"x","email":"a@b.com","password":"12345678"}`,
		`{"username":"@nicccls","display_name":"x","email":"a@b.com","password":"12345678"}`,
		`{"username":"nicccls","display_name":"x","email":"admin","password":"12345678"}`,
		`{"username":"nicccls","display_name":" ","email":"a@b.com","password":"12345678"}`,
		`{"username":"nicccls","display_name":"x","email":"a@b.com","password":"curta"}`,
	} {
		if w := postRegister(h, body); w.Code != http.StatusBadRequest {
			t.Errorf("%s: status = %d, want 400", body, w.Code)
		}
	}
	if accounts.created != nil || accounts.checks != 0 || *hashes != 0 {
		t.Error("cadastro inválido chegou no banco ou no bcrypt")
	}
}

func TestRegisterRejectsPasswordOver72Bytes(t *testing.T) {
	accounts := &fakeAccounts{}
	h, hashes := registerHandler(accounts)
	body := `{"username":"nicccls","display_name":"N","email":"n@x.com","password":"` + strings.Repeat("é", 37) + `"}`
	w := postRegister(h, body)
	if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "Senha muito longa (máx. 72 bytes)") {
		t.Fatalf("senha de 74 bytes: %d %s, want 400 com a mensagem", w.Code, w.Body.String())
	}
	if *hashes != 0 || accounts.checks != 0 {
		t.Error("senha longa não pode chegar no bcrypt nem no banco")
	}
}

func TestRegisterTakenIsGenericConflictBeforeBcrypt(t *testing.T) {
	accounts := &fakeAccounts{availableErr: user.ErrIdentityTaken}
	h, hashes := registerHandler(accounts)
	w := postRegister(h, `{"username":"  Shaco ","display_name":"S","email":" s@x.com ","password":"12345678"}`)
	if w.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409", w.Code)
	}
	if body := w.Body.String(); !strings.Contains(body, "username or email already in use") {
		t.Errorf("body = %s, want a mensagem genérica", body)
	}
	if *hashes != 0 {
		t.Error("nome já usado não pode gastar bcrypt")
	}
	if accounts.created != nil {
		t.Error("nome já usado não pode chegar no Create")
	}
}

func TestRegisterRaceStillConflicts(t *testing.T) {
	// Passou na checagem, mas outro cadastro entrou antes do INSERT.
	accounts := &fakeAccounts{err: user.ErrIdentityTaken}
	h, _ := registerHandler(accounts)
	w := postRegister(h, `{"username":"  Shaco ","display_name":"S","email":" s@x.com ","password":"12345678"}`)
	if w.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409", w.Code)
	}
	if accounts.created == nil || accounts.created.Username != "Shaco" || accounts.created.Email != "s@x.com" {
		t.Errorf("created = %+v, want usuário e e-mail sem espaços", accounts.created)
	}
}

func TestRegisterHidesDatabaseErrors(t *testing.T) {
	h, _ := registerHandler(&fakeAccounts{err: context.DeadlineExceeded})
	w := postRegister(h, `{"username":"nicccls","display_name":"N","email":"n@x.com","password":"12345678"}`)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}
	if strings.Contains(w.Body.String(), "deadline") {
		t.Errorf("body vaza o erro interno: %s", w.Body.String())
	}
}

func TestRegisterIsRateLimitedByIP(t *testing.T) {
	accounts := &fakeAccounts{availableErr: user.ErrIdentityTaken}
	h, _ := registerHandler(accounts)
	body := func(i int) string {
		return fmt.Sprintf(`{"username":"user%d","display_name":"U","email":"u%d@x.com","password":"12345678"}`, i, i)
	}
	// Sondar e-mails (409) também conta.
	for i := 0; i < registrationsPerIP; i++ {
		if w := postRegisterFrom(h, "203.0.113.5", body(i)); w.Code != http.StatusConflict {
			t.Fatalf("cadastro %d: status = %d, want 409", i+1, w.Code)
		}
	}
	w := postRegisterFrom(h, "203.0.113.5", body(99))
	if w.Code != http.StatusTooManyRequests || w.Header().Get("Retry-After") != "3600" {
		t.Fatalf("6º cadastro: %d Retry-After=%q, want 429 e 3600", w.Code, w.Header().Get("Retry-After"))
	}
	if accounts.checks != registrationsPerIP {
		t.Errorf("bloqueado ainda consultou o banco (%d checagens)", accounts.checks)
	}
	if w := postRegisterFrom(h, "203.0.113.6", body(100)); w.Code != http.StatusConflict {
		t.Errorf("outro IP: status = %d, want 409", w.Code)
	}
}

func TestRegisterDoesNotCountInvalidOrInternalErrors(t *testing.T) {
	accounts := &fakeAccounts{err: errors.New("banco fora do ar")}
	h, _ := registerHandler(accounts)
	for i := 0; i < 3*registrationsPerIP; i++ {
		postRegisterFrom(h, "203.0.113.7", `{"username":"a@b","display_name":"x","email":"a@b.com","password":"12345678"}`)
		if w := postRegisterFrom(h, "203.0.113.7", `{"username":"nicccls","display_name":"N","email":"n@x.com","password":"12345678"}`); w.Code != http.StatusInternalServerError {
			t.Fatalf("tentativa %d: status = %d, want 500 (não 429)", i+1, w.Code)
		}
	}
}
