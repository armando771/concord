package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"gin-quickstart/backend/internal/user"
)

type fakeAccounts struct {
	err     error
	created *user.User
}

func (f *fakeAccounts) Create(_ context.Context, u *user.User) error {
	f.created = u
	return f.err
}

func (f *fakeAccounts) SetBirthday(context.Context, string, user.Birthday) error { return nil }

func postRegister(h *Handler, body string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/register", h.Register)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/register", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	return w
}

func TestRegisterValidatesBeforeTouchingTheDatabase(t *testing.T) {
	h := AuthHandler(nil, nil)
	accounts := &fakeAccounts{}
	h.accounts = accounts
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
	if accounts.created != nil {
		t.Error("cadastro inválido chegou no Create")
	}
}

func TestRegisterTakenIsGenericConflict(t *testing.T) {
	h := AuthHandler(nil, nil)
	accounts := &fakeAccounts{err: user.ErrIdentityTaken}
	h.accounts = accounts
	w := postRegister(h, `{"username":"  Shaco ","display_name":"S","email":" s@x.com ","password":"12345678"}`)
	if w.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409", w.Code)
	}
	if body := w.Body.String(); !strings.Contains(body, "username or email already in use") {
		t.Errorf("body = %s, want a mensagem genérica", body)
	}
	if accounts.created == nil || accounts.created.Username != "Shaco" || accounts.created.Email != "s@x.com" {
		t.Errorf("created = %+v, want usuário e e-mail sem espaços", accounts.created)
	}
}

func TestRegisterHidesDatabaseErrors(t *testing.T) {
	h := AuthHandler(nil, nil)
	h.accounts = &fakeAccounts{err: context.DeadlineExceeded}
	w := postRegister(h, `{"username":"nicccls","display_name":"N","email":"n@x.com","password":"12345678"}`)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}
	if strings.Contains(w.Body.String(), "deadline") {
		t.Errorf("body vaza o erro interno: %s", w.Body.String())
	}
}
