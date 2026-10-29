package fcm

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// serviceAccount monta o JSON de uma conta de serviço de teste com uma chave RSA nova.
func serviceAccount(t *testing.T, tokenURI string) (string, *rsa.PublicKey) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	der, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	pemKey := string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}))
	raw, _ := json.Marshal(map[string]string{
		"project_id":   "salinha-teste",
		"client_email": "push@salinha-teste.iam.gserviceaccount.com",
		"private_key":  pemKey,
		"token_uri":    tokenURI,
	})
	return string(raw), &key.PublicKey
}

// fakeGoogle é o servidor falso: troca o JWT por um token e recebe os envios.
type fakeGoogle struct {
	mu          sync.Mutex
	tokenCalls  int
	sendCalls   []map[string]any
	sendAuth    []string
	assertion   string
	sendStatus  int
	sendBody    string
	tokenStatus int
}

func (f *fakeGoogle) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		f.tokenCalls++
		_ = r.ParseForm()
		f.assertion = r.PostForm.Get("assertion")
		if r.PostForm.Get("grant_type") != "urn:ietf:params:oauth:grant-type:jwt-bearer" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		if f.tokenStatus != 0 {
			w.WriteHeader(f.tokenStatus)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "tok-" + string(rune('0'+f.tokenCalls)), "expires_in": 3600})
	})
	mux.HandleFunc("/v1/projects/salinha-teste/messages:send", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		f.sendCalls = append(f.sendCalls, body)
		f.sendAuth = append(f.sendAuth, r.Header.Get("Authorization"))
		status := f.sendStatus
		if status == 0 {
			status = http.StatusOK
		}
		w.WriteHeader(status)
		_, _ = w.Write([]byte(f.sendBody))
	})
	return mux
}

func newClient(t *testing.T, f *fakeGoogle, now func() time.Time) *Client {
	t.Helper()
	srv := httptest.NewServer(f.handler())
	t.Cleanup(srv.Close)
	raw, _ := serviceAccount(t, srv.URL+"/token")
	cfg, err := LoadConfig(func(k string) string {
		if k == "FCM_SERVICE_ACCOUNT_JSON" {
			return raw
		}
		if k == "FCM_ENDPOINT" {
			return srv.URL
		}
		return ""
	}, nil)
	if err != nil || cfg == nil {
		t.Fatalf("LoadConfig: %v, %v", cfg, err)
	}
	return New(cfg, srv.Client(), now)
}

func TestLoadConfig(t *testing.T) {
	raw, _ := serviceAccount(t, "https://oauth2.example/token")
	env := func(m map[string]string) func(string) string { return func(k string) string { return m[k] } }

	t.Run("sem variáveis: desligado (nil, sem erro)", func(t *testing.T) {
		cfg, err := LoadConfig(env(nil), nil)
		if cfg != nil || err != nil {
			t.Fatalf("esperava nil, nil; veio %v, %v", cfg, err)
		}
	})

	t.Run("JSON inline", func(t *testing.T) {
		cfg, err := LoadConfig(env(map[string]string{"FCM_SERVICE_ACCOUNT_JSON": raw}), nil)
		if err != nil || cfg == nil || cfg.ProjectID != "salinha-teste" {
			t.Fatalf("cfg=%v err=%v", cfg, err)
		}
		if cfg.Endpoint != "https://fcm.googleapis.com" || cfg.TokenURL != "https://oauth2.example/token" {
			t.Fatalf("endereços padrão errados: %+v", cfg)
		}
	})

	t.Run("arquivo", func(t *testing.T) {
		read := func(path string) ([]byte, error) {
			if path != "/segredos/fcm.json" {
				return nil, errors.New("arquivo inesperado")
			}
			return []byte(raw), nil
		}
		cfg, err := LoadConfig(env(map[string]string{"FCM_SERVICE_ACCOUNT_FILE": "/segredos/fcm.json"}), read)
		if err != nil || cfg == nil {
			t.Fatalf("cfg=%v err=%v", cfg, err)
		}
	})

	t.Run("endereços podem ser trocados (servidor falso nos testes)", func(t *testing.T) {
		cfg, err := LoadConfig(env(map[string]string{
			"FCM_SERVICE_ACCOUNT_JSON": raw, "FCM_ENDPOINT": "http://127.0.0.1:9000", "FCM_TOKEN_URL": "http://127.0.0.1:9000/token",
		}), nil)
		if err != nil || cfg.Endpoint != "http://127.0.0.1:9000" || cfg.TokenURL != "http://127.0.0.1:9000/token" {
			t.Fatalf("cfg=%+v err=%v", cfg, err)
		}
	})

	t.Run("JSON inválido ou incompleto é erro (não liga calado)", func(t *testing.T) {
		for _, bad := range []string{"{quebrado", `{"project_id":"x"}`} {
			if _, err := LoadConfig(env(map[string]string{"FCM_SERVICE_ACCOUNT_JSON": bad}), nil); err == nil {
				t.Fatalf("esperava erro para %q", bad)
			}
		}
	})

	t.Run("arquivo ilegível é erro", func(t *testing.T) {
		read := func(string) ([]byte, error) { return nil, errors.New("sem permissão") }
		if _, err := LoadConfig(env(map[string]string{"FCM_SERVICE_ACCOUNT_FILE": "/x"}), read); err == nil {
			t.Fatal("esperava erro")
		}
	})
}

func TestSendAssinaJWTEEnviaAMensagem(t *testing.T) {
	f := &fakeGoogle{}
	c := newClient(t, f, time.Now)
	err := c.Send(context.Background(), Message{
		Token: "device-1", Title: "Ana", Body: "oi", Data: map[string]string{"type": "dm", "conversation_id": "c1"},
	})
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	if f.tokenCalls != 1 || len(f.sendCalls) != 1 {
		t.Fatalf("token=%d envios=%d", f.tokenCalls, len(f.sendCalls))
	}
	if f.sendAuth[0] != "Bearer tok-1" {
		t.Fatalf("Authorization = %q", f.sendAuth[0])
	}
	msg := f.sendCalls[0]["message"].(map[string]any)
	if msg["token"] != "device-1" {
		t.Fatalf("token do aparelho = %v", msg["token"])
	}
	notif := msg["notification"].(map[string]any)
	if notif["title"] != "Ana" || notif["body"] != "oi" {
		t.Fatalf("notification = %v", notif)
	}
	data := msg["data"].(map[string]any)
	if data["type"] != "dm" || data["conversation_id"] != "c1" {
		t.Fatalf("data = %v", data)
	}
	android := msg["android"].(map[string]any)
	if android["priority"] != "HIGH" || android["notification"].(map[string]any)["channel_id"] != "mensagens" {
		t.Fatalf("android = %v", android)
	}
}

func TestJWTTemAsCamposEAssinaturaValida(t *testing.T) {
	f := &fakeGoogle{}
	srv := httptest.NewServer(f.handler())
	defer srv.Close()
	raw, pub := serviceAccount(t, srv.URL+"/token")
	cfg, _ := LoadConfig(func(k string) string {
		if k == "FCM_SERVICE_ACCOUNT_JSON" {
			return raw
		}
		if k == "FCM_ENDPOINT" {
			return srv.URL
		}
		return ""
	}, nil)
	now := time.Unix(1_800_000_000, 0)
	c := New(cfg, srv.Client(), func() time.Time { return now })
	if err := c.Send(context.Background(), Message{Token: "d", Title: "t", Body: "b"}); err != nil {
		t.Fatal(err)
	}

	parts := strings.Split(f.assertion, ".")
	if len(parts) != 3 {
		t.Fatalf("JWT com %d partes", len(parts))
	}
	var header, claims map[string]any
	decode := func(s string, into *map[string]any) {
		b, err := base64.RawURLEncoding.DecodeString(s)
		if err != nil || json.Unmarshal(b, into) != nil {
			t.Fatalf("parte inválida: %v", err)
		}
	}
	decode(parts[0], &header)
	decode(parts[1], &claims)
	if header["alg"] != "RS256" || header["typ"] != "JWT" {
		t.Fatalf("header = %v", header)
	}
	if claims["iss"] != "push@salinha-teste.iam.gserviceaccount.com" ||
		claims["scope"] != "https://www.googleapis.com/auth/firebase.messaging" ||
		claims["aud"] != srv.URL+"/token" {
		t.Fatalf("claims = %v", claims)
	}
	if int64(claims["iat"].(float64)) != now.Unix() || int64(claims["exp"].(float64)) != now.Add(time.Hour).Unix() {
		t.Fatalf("iat/exp = %v/%v", claims["iat"], claims["exp"])
	}
	sig, _ := base64.RawURLEncoding.DecodeString(parts[2])
	sum := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err := rsa.VerifyPKCS1v15(pub, 5 /* crypto.SHA256 */, sum[:], sig); err != nil {
		t.Fatalf("assinatura inválida: %v", err)
	}
}

func TestTokenEmCacheAteVencer(t *testing.T) {
	f := &fakeGoogle{}
	now := time.Unix(1_800_000_000, 0)
	c := newClient(t, f, func() time.Time { return now })
	send := func() {
		if err := c.Send(context.Background(), Message{Token: "d", Title: "t", Body: "b"}); err != nil {
			t.Fatal(err)
		}
	}
	send()
	send()
	if f.tokenCalls != 1 {
		t.Fatalf("2 envios seguidos devem usar o mesmo token (chamadas = %d)", f.tokenCalls)
	}
	now = now.Add(59 * time.Minute) // dentro da folga de renovação (1 min antes de vencer)
	send()
	if f.tokenCalls != 2 {
		t.Fatalf("perto de vencer, renova (chamadas = %d)", f.tokenCalls)
	}
	if f.sendAuth[2] != "Bearer tok-2" {
		t.Fatalf("o terceiro envio deve usar o token novo: %q", f.sendAuth[2])
	}
}

func TestSendErros(t *testing.T) {
	t.Run("token do aparelho não registrado vira ErrUnregistered", func(t *testing.T) {
		f := &fakeGoogle{sendStatus: http.StatusNotFound, sendBody: `{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}`}
		err := newClient(t, f, time.Now).Send(context.Background(), Message{Token: "velho", Title: "t", Body: "b"})
		if !errors.Is(err, ErrUnregistered) {
			t.Fatalf("err = %v", err)
		}
	})

	t.Run("outro erro do FCM não apaga o token", func(t *testing.T) {
		f := &fakeGoogle{sendStatus: http.StatusInternalServerError, sendBody: `{"error":{"message":"fora do ar"}}`}
		err := newClient(t, f, time.Now).Send(context.Background(), Message{Token: "d", Title: "t", Body: "b"})
		if err == nil || errors.Is(err, ErrUnregistered) {
			t.Fatalf("err = %v", err)
		}
	})

	t.Run("falha ao trocar o JWT pelo token", func(t *testing.T) {
		f := &fakeGoogle{tokenStatus: http.StatusUnauthorized}
		err := newClient(t, f, time.Now).Send(context.Background(), Message{Token: "d", Title: "t", Body: "b"})
		if err == nil || len(f.sendCalls) != 0 {
			t.Fatalf("err = %v, envios = %d", err, len(f.sendCalls))
		}
	})

	t.Run("cliente nil (push desligado) não envia nem dá erro", func(t *testing.T) {
		var c *Client
		if err := c.Send(context.Background(), Message{Token: "d"}); err != nil {
			t.Fatalf("err = %v", err)
		}
		if c.Enabled() {
			t.Fatal("cliente nil não pode estar ligado")
		}
	})
}

func TestSendUsaOCanalDaMensagem(t *testing.T) {
	f := &fakeGoogle{}
	c := newClient(t, f, time.Now)
	if err := c.Send(context.Background(), Message{Token: "d", Title: "Ana", Body: "Está te ligando", Channel: "chamadas"}); err != nil {
		t.Fatalf("Send: %v", err)
	}
	msg := f.sendCalls[0]["message"].(map[string]any)
	channel := msg["android"].(map[string]any)["notification"].(map[string]any)["channel_id"]
	if channel != "chamadas" {
		t.Fatalf("channel_id = %v, esperava chamadas", channel)
	}
}
