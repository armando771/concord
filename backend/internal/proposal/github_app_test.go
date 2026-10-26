package proposal

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func testKey(t *testing.T) (*rsa.PrivateKey, []byte) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	pkcs1 := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})
	return key, pkcs1
}

// fakeGitHub imita só o que o cliente usa: a troca do JWT do App por um token
// de instalação e a criação da issue com esse token.
type fakeGitHub struct {
	srv            *httptest.Server
	tokenCalls     atomic.Int32
	issueCalls     atomic.Int32
	tokenLifetime  time.Duration
	rejectNextAuth atomic.Bool
	lastIssueAuth  atomic.Value // string
}

func newFakeGitHub(t *testing.T, pub *rsa.PublicKey, appID, installationID string) *fakeGitHub {
	t.Helper()
	f := &fakeGitHub{tokenLifetime: time.Hour}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /app/installations/"+installationID+"/access_tokens", func(w http.ResponseWriter, r *http.Request) {
		raw := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		claims := jwt.RegisteredClaims{}
		tok, err := jwt.ParseWithClaims(raw, &claims, func(*jwt.Token) (any, error) { return pub, nil },
			jwt.WithValidMethods([]string{"RS256"}))
		if err != nil || !tok.Valid || claims.Issuer != appID {
			http.Error(w, `{"message":"A JSON web token could not be decoded"}`, http.StatusUnauthorized)
			return
		}
		// O GitHub recusa JWT com mais de 10 minutos de vida.
		if claims.ExpiresAt.Sub(claims.IssuedAt.Time) > 10*time.Minute {
			http.Error(w, `{"message":"'Expiration time' too far in the future"}`, http.StatusUnauthorized)
			return
		}
		n := f.tokenCalls.Add(1)
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"token":"ghs_install_` + string(rune('0'+n)) + `","expires_at":"` +
			time.Now().Add(f.tokenLifetime).UTC().Format(time.RFC3339) + `"}`))
	})
	mux.HandleFunc("POST /repos/o/r/issues", func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		f.lastIssueAuth.Store(auth)
		if f.rejectNextAuth.CompareAndSwap(true, false) || !strings.HasPrefix(auth, "Bearer ghs_install_") {
			http.Error(w, `{"message":"Bad credentials"}`, http.StatusUnauthorized)
			return
		}
		n := f.issueCalls.Add(1)
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"number":` + string(rune('0'+n)) + `,"html_url":"https://github.com/o/r/issues/` + string(rune('0'+n)) + `"}`))
	})
	f.srv = httptest.NewServer(mux)
	t.Cleanup(f.srv.Close)
	return f
}

func TestAppClientCreatesIssueWithInstallationToken(t *testing.T) {
	key, pemKey := testKey(t)
	gh := newFakeGitHub(t, &key.PublicKey, "123", "456")

	c, err := NewGitHubAppClient("123", "456", pemKey, "o/r")
	if err != nil {
		t.Fatal(err)
	}
	c.WithBaseURL(gh.srv.URL)

	n, url, err := c.CreateIssue(context.Background(), Proposal{Title: "x"})
	if err != nil || n != 1 || !strings.HasSuffix(url, "/issues/1") {
		t.Fatalf("got %d %q %v", n, url, err)
	}
	// A issue vai com o token de instalação, nunca com o JWT do App.
	if got := gh.lastIssueAuth.Load().(string); got != "Bearer ghs_install_1" {
		t.Fatalf("auth da issue = %q", got)
	}
}

func TestAppTokenIsCachedUntilNearExpiry(t *testing.T) {
	key, pemKey := testKey(t)
	gh := newFakeGitHub(t, &key.PublicKey, "123", "456")
	c, _ := NewGitHubAppClient("123", "456", pemKey, "o/r")
	c.WithBaseURL(gh.srv.URL)
	ctx := context.Background()

	for range 3 {
		if _, _, err := c.CreateIssue(ctx, Proposal{Title: "x"}); err != nil {
			t.Fatal(err)
		}
	}
	if got := gh.tokenCalls.Load(); got != 1 {
		t.Fatalf("pediu token de instalação %d vezes, esperado 1 (cache)", got)
	}

	// Perto de vencer (menos de 5 min), renova.
	app := c.tokens.(*appTokens)
	app.now = func() time.Time { return time.Now().Add(56 * time.Minute) }
	if _, _, err := c.CreateIssue(ctx, Proposal{Title: "x"}); err != nil {
		t.Fatal(err)
	}
	if got := gh.tokenCalls.Load(); got != 2 {
		t.Fatalf("deveria renovar perto do vencimento: chamadas = %d", got)
	}
}

func TestAppTokenInvalidatedAfter401(t *testing.T) {
	key, pemKey := testKey(t)
	gh := newFakeGitHub(t, &key.PublicKey, "123", "456")
	c, _ := NewGitHubAppClient("123", "456", pemKey, "o/r")
	c.WithBaseURL(gh.srv.URL)
	ctx := context.Background()

	if _, _, err := c.CreateIssue(ctx, Proposal{Title: "x"}); err != nil {
		t.Fatal(err)
	}
	gh.rejectNextAuth.Store(true) // token revogado do lado do GitHub
	if _, _, err := c.CreateIssue(ctx, Proposal{Title: "x"}); err == nil {
		t.Fatal("deveria falhar com 401")
	}
	// A nova tentativa pede outro token de instalação e funciona.
	if _, _, err := c.CreateIssue(ctx, Proposal{Title: "x"}); err != nil {
		t.Fatalf("nova tentativa: %v", err)
	}
	if got := gh.tokenCalls.Load(); got != 2 {
		t.Fatalf("token de instalação pedido %d vezes, esperado 2", got)
	}
}

func TestAppRejectsWrongKeyOrIDs(t *testing.T) {
	key, _ := testKey(t)
	_, otherPEM := testKey(t) // chave que o GitHub não conhece
	gh := newFakeGitHub(t, &key.PublicKey, "123", "456")

	c, _ := NewGitHubAppClient("123", "456", otherPEM, "o/r")
	c.WithBaseURL(gh.srv.URL)
	if _, _, err := c.CreateIssue(context.Background(), Proposal{Title: "x"}); err == nil ||
		!strings.Contains(err.Error(), "401") {
		t.Fatalf("chave errada deveria dar 401, veio %v", err)
	}
	if gh.issueCalls.Load() != 0 {
		t.Fatal("não deveria chegar a criar a issue")
	}
}

func TestParsePrivateKeyFormats(t *testing.T) {
	key, pkcs1 := testKey(t)
	if _, err := parsePrivateKey(pkcs1); err != nil {
		t.Fatalf("PKCS#1: %v", err)
	}
	der, _ := x509.MarshalPKCS8PrivateKey(key)
	pkcs8 := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})
	if _, err := parsePrivateKey(pkcs8); err != nil {
		t.Fatalf("PKCS#8: %v", err)
	}
	if _, err := parsePrivateKey([]byte("isto não é um pem")); err == nil {
		t.Fatal("lixo deveria falhar")
	}
	if _, err := NewGitHubAppClient("", "456", pkcs1, "o/r"); err == nil {
		t.Fatal("app id vazio deveria falhar")
	}
}
