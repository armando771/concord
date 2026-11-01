package fcm

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// ErrUnregistered: o FCM não reconhece mais o token (app desinstalado ou token renovado). Quem chama
// apaga o token do banco.
var ErrUnregistered = errors.New("fcm: token não registrado")

const (
	scope         = "https://www.googleapis.com/auth/firebase.messaging"
	jwtLifetime   = time.Hour
	renewMargin   = time.Minute
	androidChanel = "mensagens"
)

// Message é um push para um aparelho. Data viaja junto para o app decidir a tela ao tocar.
type Message struct {
	Token string
	Title string
	Body  string
	Data  map[string]string
	// Channel é o canal de notificação do Android; vazio usa o de mensagens.
	Channel string
}

// Client fala com o FCM. O valor nil é o push desligado: Send não faz nada e não dá erro.
type Client struct {
	cfg  *Config
	http *http.Client
	now  func() time.Time

	mu      sync.Mutex
	token   string
	expires time.Time
}

// New monta o cliente; httpClient e now podem ser nil (padrões).
func New(cfg *Config, httpClient *http.Client, now func() time.Time) *Client {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 10 * time.Second}
	}
	if now == nil {
		now = time.Now
	}
	return &Client{cfg: cfg, http: httpClient, now: now}
}

// Enabled diz se há credenciais (o cliente nil e o sem config estão desligados).
func (c *Client) Enabled() bool { return c != nil && c.cfg != nil }

// Send entrega a mensagem. Token não registrado devolve ErrUnregistered.
func (c *Client) Send(ctx context.Context, m Message) error {
	if !c.Enabled() {
		return nil
	}
	access, err := c.accessToken(ctx)
	if err != nil {
		return err
	}
	channel := m.Channel
	if channel == "" {
		channel = androidChanel
	}
	body, err := json.Marshal(map[string]any{"message": map[string]any{
		"token":        m.Token,
		"notification": map[string]string{"title": m.Title, "body": m.Body},
		"data":         m.Data,
		"android": map[string]any{
			"priority":     "HIGH",
			"notification": map[string]string{"channel_id": channel},
		},
	}})
	if err != nil {
		return err
	}
	endpoint := strings.TrimRight(c.cfg.Endpoint, "/") + "/v1/projects/" + c.cfg.ProjectID + "/messages:send"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+access)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("fcm: enviando: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 == 2 {
		return nil
	}
	detail, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode == http.StatusNotFound || strings.Contains(string(detail), "UNREGISTERED") {
		return ErrUnregistered
	}
	return fmt.Errorf("fcm: HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(detail)))
}

// accessToken devolve o token OAuth2 em cache, renovando um minuto antes de vencer.
func (c *Client) accessToken(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.token != "" && c.now().Before(c.expires.Add(-renewMargin)) {
		return c.token, nil
	}
	assertion, err := c.signedJWT()
	if err != nil {
		return "", err
	}
	form := url.Values{
		"grant_type": {"urn:ietf:params:oauth:grant-type:jwt-bearer"},
		"assertion":  {assertion},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.TokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("fcm: pedindo token: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("fcm: token OAuth2 recusado (HTTP %d)", resp.StatusCode)
	}
	var out struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int64  `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil || out.AccessToken == "" {
		return "", errors.New("fcm: resposta de token inválida")
	}
	c.token = out.AccessToken
	c.expires = c.now().Add(time.Duration(out.ExpiresIn) * time.Second)
	return c.token, nil
}

// signedJWT monta o JWT RS256 da conta de serviço (iss, scope, aud, iat, exp).
func (c *Client) signedJWT() (string, error) {
	enc := base64.RawURLEncoding
	now := c.now()
	header, _ := json.Marshal(map[string]string{"alg": "RS256", "typ": "JWT"})
	claims, _ := json.Marshal(map[string]any{
		"iss":   c.cfg.ClientEmail,
		"scope": scope,
		"aud":   c.cfg.TokenURL,
		"iat":   now.Unix(),
		"exp":   now.Add(jwtLifetime).Unix(),
	})
	signingInput := enc.EncodeToString(header) + "." + enc.EncodeToString(claims)
	sum := sha256.Sum256([]byte(signingInput))
	sig, err := rsa.SignPKCS1v15(rand.Reader, c.cfg.PrivateKey, crypto.SHA256, sum[:])
	if err != nil {
		return "", fmt.Errorf("fcm: assinando JWT: %w", err)
	}
	return signingInput + "." + enc.EncodeToString(sig), nil
}
