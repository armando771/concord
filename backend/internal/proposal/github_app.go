package proposal

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// tokenSource entrega o token que autentica as chamadas à API do GitHub.
type tokenSource interface {
	Token(ctx context.Context) (string, error)
	// Invalidate descarta o token em cache (o GitHub recusou: revogado ou expirado).
	Invalidate()
}

// staticToken é um token fixo (GITHUB_TOKEN, pessoal ou de uma conta robô).
type staticToken string

func (t staticToken) Token(context.Context) (string, error) { return string(t), nil }
func (staticToken) Invalidate()                             {}

// Os tokens de instalação do GitHub App duram 1 hora; renova com folga.
const appTokenRenewBefore = 5 * time.Minute

// appTokens autentica como um GitHub App: assina um JWT com a chave privada do
// App e o troca por um token de instalação (as issues saem como "<app>[bot]").
type appTokens struct {
	appID          string
	installationID string
	key            *rsa.PrivateKey
	base           string
	http           *http.Client
	now            func() time.Time

	mu      sync.Mutex
	token   string
	expires time.Time
}

// NewGitHubAppClient cria issues como um GitHub App instalado no repositório.
// pemKey é a chave privada (.pem) gerada nas configurações do App.
func NewGitHubAppClient(appID, installationID string, pemKey []byte, repo string) (*GitHubClient, error) {
	key, err := parsePrivateKey(pemKey)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(appID) == "" || strings.TrimSpace(installationID) == "" {
		return nil, errors.New("github app: app id e installation id são obrigatórios")
	}
	c := NewGitHubClient("", repo)
	c.tokens = &appTokens{
		appID:          strings.TrimSpace(appID),
		installationID: strings.TrimSpace(installationID),
		key:            key,
		base:           c.base,
		http:           c.http,
		now:            time.Now,
	}
	return c, nil
}

// parsePrivateKey lê a chave do App: PKCS#1 ("RSA PRIVATE KEY", o formato que o
// GitHub gera) ou PKCS#8.
func parsePrivateKey(data []byte) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode(data)
	if block == nil {
		return nil, errors.New("github app: chave privada não é um PEM válido")
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("github app: chave privada ilegível: %w", err)
	}
	key, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("github app: a chave privada precisa ser RSA")
	}
	return key, nil
}

func (a *appTokens) Token(ctx context.Context) (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.token != "" && a.now().Add(appTokenRenewBefore).Before(a.expires) {
		return a.token, nil
	}

	now := a.now()
	// iat 60 s no passado absorve relógio um pouco adiantado; o GitHub aceita até 10 min.
	signed, err := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.RegisteredClaims{
		Issuer:    a.appID,
		IssuedAt:  jwt.NewNumericDate(now.Add(-60 * time.Second)),
		ExpiresAt: jwt.NewNumericDate(now.Add(9 * time.Minute)),
	}).SignedString(a.key)
	if err != nil {
		return "", fmt.Errorf("github app: assinar jwt: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		a.base+"/app/installations/"+a.installationID+"/access_tokens", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+signed)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	res, err := a.http.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("github app: token de instalação: status %d: %s",
			res.StatusCode, strings.TrimSpace(string(raw)))
	}
	var out struct {
		Token     string    `json:"token"`
		ExpiresAt time.Time `json:"expires_at"`
	}
	if err := json.Unmarshal(raw, &out); err != nil || out.Token == "" {
		return "", errors.New("github app: resposta de token de instalação inválida")
	}
	a.token, a.expires = out.Token, out.ExpiresAt
	return a.token, nil
}

func (a *appTokens) Invalidate() {
	a.mu.Lock()
	a.token = ""
	a.mu.Unlock()
}
