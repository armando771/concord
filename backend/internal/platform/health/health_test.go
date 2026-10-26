package health

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func get(t *testing.T, r *Readiness) int {
	t.Helper()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/healthz", r.Handler)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	return rec.Code
}

func okPing(context.Context) error { return nil }

func TestNotReadyBeforeBootFinishes(t *testing.T) {
	r := New(okPing)
	if code := get(t, r); code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503 antes de SetReady", code)
	}
}

func TestReadyWhenBootedAndDatabaseAnswers(t *testing.T) {
	r := New(okPing)
	r.SetReady()
	if code := get(t, r); code != http.StatusOK {
		t.Fatalf("status = %d, want 200", code)
	}
}

func TestNotReadyWhenDatabaseIsDown(t *testing.T) {
	r := New(func(context.Context) error { return errors.New("connection refused") })
	r.SetReady()
	if code := get(t, r); code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503 com o banco fora", code)
	}
}

func TestNotReadyWhileStopping(t *testing.T) {
	r := New(okPing)
	r.SetReady()
	r.SetStopping()
	if code := get(t, r); code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503 desligando", code)
	}
}

// Bater muito no /healthz (é público) não vira uma consulta ao banco por
// requisição.
func TestDatabasePingedAtMostOncePerInterval(t *testing.T) {
	pings := 0
	r := New(func(context.Context) error { pings++; return nil })
	r.SetReady()
	for i := 0; i < 50; i++ {
		if code := get(t, r); code != http.StatusOK {
			t.Fatalf("status = %d, want 200", code)
		}
	}
	if pings != 1 {
		t.Fatalf("pings = %d, want 1 dentro de pingEvery", pings)
	}
}

// Um cliente que desiste da requisição no meio não pode deixar "banco fora"
// guardado: o próximo /healthz tem que ver o banco de verdade.
func TestCanceledRequestDoesNotCacheDatabaseFailure(t *testing.T) {
	r := New(func(ctx context.Context) error { return ctx.Err() })
	r.SetReady()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/healthz", r.Handler)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil).WithContext(ctx))

	if code := get(t, r); code != http.StatusOK {
		t.Fatalf("status = %d depois de uma requisição cancelada, want 200", code)
	}
}
