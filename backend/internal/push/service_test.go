package push

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

type fakeStore struct {
	upserts []string // "user|token|platform"
	deletes []string // "user|token"
	err     error
}

func (s *fakeStore) Upsert(_ context.Context, userID, token, platform string) error {
	s.upserts = append(s.upserts, userID+"|"+token+"|"+platform)
	return s.err
}
func (s *fakeStore) DeleteForUser(_ context.Context, userID, token string) error {
	s.deletes = append(s.deletes, userID+"|"+token)
	return s.err
}

func TestServiceRegister(t *testing.T) {
	t.Run("registra token Android do usuário", func(t *testing.T) {
		st := &fakeStore{}
		if err := NewService(st).Register(context.Background(), "u1", "tok-123", "android"); err != nil {
			t.Fatal(err)
		}
		if len(st.upserts) != 1 || st.upserts[0] != "u1|tok-123|android" {
			t.Fatalf("upserts = %v", st.upserts)
		}
	})

	t.Run("token vazio, enorme ou plataforma desconhecida é inválido (nada vai ao banco)", func(t *testing.T) {
		for name, c := range map[string][3]string{
			"vazio":       {"u1", "  ", "android"},
			"enorme":      {"u1", strings.Repeat("x", maxTokenLength+1), "android"},
			"plataforma":  {"u1", "tok", "ios"},
			"sem usuário": {"", "tok", "android"},
		} {
			st := &fakeStore{}
			err := NewService(st).Register(context.Background(), c[0], c[1], c[2])
			if !errors.Is(err, ErrInvalidToken) || len(st.upserts) != 0 {
				t.Fatalf("%s: err=%v upserts=%v", name, err, st.upserts)
			}
		}
	})

	t.Run("aparece o erro do banco", func(t *testing.T) {
		st := &fakeStore{err: errors.New("banco fora")}
		if err := NewService(st).Register(context.Background(), "u1", "tok", "android"); err == nil {
			t.Fatal("esperava erro")
		}
	})
}

func TestServiceUnregister(t *testing.T) {
	st := &fakeStore{}
	if err := NewService(st).Unregister(context.Background(), "u1", " tok-123 "); err != nil {
		t.Fatal(err)
	}
	if len(st.deletes) != 1 || st.deletes[0] != "u1|tok-123" {
		t.Fatalf("deletes = %v", st.deletes)
	}
	if err := NewService(st).Unregister(context.Background(), "u1", ""); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("token vazio: %v", err)
	}
}

func handlerRig(user string) (*gin.Engine, *fakeStore) {
	gin.SetMode(gin.TestMode)
	st := &fakeStore{}
	r := gin.New()
	auth := func(c *gin.Context) {
		if user != "" {
			c.Set("userID", user)
		}
		c.Next()
	}
	Routes(r.Group("/api"), PushHandler(NewService(st)), auth)
	return r, st
}

func call(r *gin.Engine, method, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, "/api/push/token", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestHandler(t *testing.T) {
	t.Run("PUT registra e responde 204", func(t *testing.T) {
		r, st := handlerRig("u1")
		w := call(r, http.MethodPut, `{"token":"tok-1","platform":"android"}`)
		if w.Code != http.StatusNoContent || len(st.upserts) != 1 {
			t.Fatalf("status=%d upserts=%v", w.Code, st.upserts)
		}
	})

	t.Run("PUT sem plataforma assume Android", func(t *testing.T) {
		r, st := handlerRig("u1")
		w := call(r, http.MethodPut, `{"token":"tok-1"}`)
		if w.Code != http.StatusNoContent || st.upserts[0] != "u1|tok-1|android" {
			t.Fatalf("status=%d upserts=%v", w.Code, st.upserts)
		}
	})

	t.Run("corpo inválido ou token inválido: 400", func(t *testing.T) {
		r, st := handlerRig("u1")
		for _, body := range []string{`{quebrado`, `{"token":""}`, `{"token":"t","platform":"ios"}`} {
			if w := call(r, http.MethodPut, body); w.Code != http.StatusBadRequest {
				t.Fatalf("%s: status %d", body, w.Code)
			}
		}
		if len(st.upserts) != 0 {
			t.Fatalf("nada deve ir ao banco: %v", st.upserts)
		}
	})

	t.Run("DELETE remove só o token do próprio usuário", func(t *testing.T) {
		r, st := handlerRig("u1")
		w := call(r, http.MethodDelete, `{"token":"tok-1"}`)
		if w.Code != http.StatusNoContent || st.deletes[0] != "u1|tok-1" {
			t.Fatalf("status=%d deletes=%v", w.Code, st.deletes)
		}
	})

	t.Run("erro do banco vira 500 sem vazar detalhe", func(t *testing.T) {
		r, st := handlerRig("u1")
		st.err = errors.New("senha do banco: abc")
		w := call(r, http.MethodPut, `{"token":"tok-1"}`)
		if w.Code != http.StatusInternalServerError || strings.Contains(w.Body.String(), "abc") {
			t.Fatalf("status=%d corpo=%s", w.Code, w.Body.String())
		}
	})

	t.Run("sem usuário autenticado: 401", func(t *testing.T) {
		r, _ := handlerRig("")
		if w := call(r, http.MethodPut, `{"token":"tok-1"}`); w.Code != http.StatusUnauthorized {
			t.Fatalf("status %d", w.Code)
		}
	})
}
