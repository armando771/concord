// Package fcm envia push pela API HTTP v1 do Firebase Cloud Messaging, autenticando com a conta de
// serviço do Firebase (docs/adr/0022-push-direto-pelo-fcm.md). O JWT é assinado com a biblioteca
// padrão: sem dependência nova. Sem credenciais o push fica desligado e o resto do backend segue normal.
package fcm

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
)

const (
	defaultEndpoint = "https://fcm.googleapis.com"
	defaultTokenURL = "https://oauth2.googleapis.com/token"
)

// Config é a conta de serviço já lida e validada, mais os endereços (trocáveis nos testes).
type Config struct {
	ProjectID   string
	ClientEmail string
	PrivateKey  *rsa.PrivateKey
	TokenURL    string
	Endpoint    string
}

type serviceAccountFile struct {
	ProjectID   string `json:"project_id"`
	ClientEmail string `json:"client_email"`
	PrivateKey  string `json:"private_key"`
	TokenURI    string `json:"token_uri"`
}

// LoadConfig lê a conta de serviço de FCM_SERVICE_ACCOUNT_JSON (conteúdo) ou FCM_SERVICE_ACCOUNT_FILE
// (caminho). Sem nenhuma das duas devolve (nil, nil): push desligado. Credencial presente mas
// inválida é erro, para não ligar calado com a chave errada.
func LoadConfig(getenv func(string) string, readFile func(string) ([]byte, error)) (*Config, error) {
	raw := []byte(getenv("FCM_SERVICE_ACCOUNT_JSON"))
	if len(raw) == 0 {
		path := getenv("FCM_SERVICE_ACCOUNT_FILE")
		if path == "" {
			return nil, nil
		}
		if readFile == nil {
			return nil, errors.New("fcm: sem leitor de arquivo")
		}
		data, err := readFile(path)
		if err != nil {
			return nil, fmt.Errorf("fcm: lendo %s: %w", path, err)
		}
		raw = data
	}

	var sa serviceAccountFile
	if err := json.Unmarshal(raw, &sa); err != nil {
		return nil, fmt.Errorf("fcm: conta de serviço inválida: %w", err)
	}
	if sa.ProjectID == "" || sa.ClientEmail == "" || sa.PrivateKey == "" {
		return nil, errors.New("fcm: conta de serviço sem project_id, client_email ou private_key")
	}
	key, err := parsePrivateKey(sa.PrivateKey)
	if err != nil {
		return nil, err
	}
	return &Config{
		ProjectID:   sa.ProjectID,
		ClientEmail: sa.ClientEmail,
		PrivateKey:  key,
		TokenURL:    firstNonEmpty(getenv("FCM_TOKEN_URL"), sa.TokenURI, defaultTokenURL),
		Endpoint:    firstNonEmpty(getenv("FCM_ENDPOINT"), defaultEndpoint),
	}, nil
}

func parsePrivateKey(pemText string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(pemText))
	if block == nil {
		return nil, errors.New("fcm: private_key não é PEM")
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("fcm: private_key inválida: %w", err)
	}
	key, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("fcm: private_key não é RSA")
	}
	return key, nil
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
