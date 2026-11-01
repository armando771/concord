package message

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"gin-quickstart/backend/internal/permission"

	"github.com/gin-gonic/gin"
)

func newTTSRouter(perms int64, access fakeAccess) *gin.Engine {
	gin.SetMode(gin.TestMode)
	svc, _, _ := ttsEnv(&fakeInviteStore{})
	h := NewTTSHandler(svc, allowAll{perms: perms}, access)
	r := gin.New()
	TTSRoutes(r.Group("/api"), h, func(c *gin.Context) { c.Set("userID", "ana"); c.Next() })
	return r
}

func postTTS(r *gin.Engine, path, content string) *httptest.ResponseRecorder {
	raw, _ := json.Marshal(map[string]string{"content": content})
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

const ttsAllowed = permission.ViewChannel | permission.SendMessages | permission.SendTTSMessages

func TestTTSHandlerCanal(t *testing.T) {
	cases := []struct {
		name    string
		perms   int64
		content string
		status  int
		code    string
	}{
		{"com a permissão cria a mensagem", ttsAllowed, "oi", http.StatusCreated, ""},
		{"sem Enviar mensagens TTS é 403", ttsAllowed &^ permission.SendTTSMessages, "oi", http.StatusForbidden, "missing_permission"},
		{"canal que não vê é 404", 0, "oi", http.StatusNotFound, "channel_not_found"},
		{"texto longo é 400", ttsAllowed, strings.Repeat("a", TTSMaxLength+1), http.StatusBadRequest, "tts_too_long"},
		{"texto vazio é 400", ttsAllowed, "  ", http.StatusBadRequest, "content_required"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := postTTS(newTTSRouter(c.perms, fakeAccess{}), "/api/channels/ch1/tts", c.content)
			if rec.Code != c.status || (c.code != "" && !strings.Contains(rec.Body.String(), `"code":"`+c.code+`"`)) {
				t.Fatalf("status %d body %s; want %d %s", rec.Code, rec.Body, c.status, c.code)
			}
		})
	}
}

func TestTTSHandlerCooldownE429ComRetryAfter(t *testing.T) {
	r := newTTSRouter(ttsAllowed, fakeAccess{})
	if rec := postTTS(r, "/api/channels/ch1/tts", "um"); rec.Code != http.StatusCreated {
		t.Fatalf("primeira: %d", rec.Code)
	}
	rec := postTTS(r, "/api/conversations/dm1/tts", "dois")
	var body struct {
		Code       string `json:"code"`
		RetryAfter int    `json:"retry_after"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if rec.Code != http.StatusTooManyRequests || body.Code != "tts_cooldown" || body.RetryAfter != 10 {
		t.Fatalf("status %d body %s", rec.Code, rec.Body)
	}
}

func TestTTSHandlerDM(t *testing.T) {
	if rec := postTTS(newTTSRouter(0, fakeAccess{}), "/api/conversations/dm1/tts", "oi"); rec.Code != http.StatusCreated {
		t.Fatalf("participante: %d %s", rec.Code, rec.Body)
	}
	if rec := postTTS(newTTSRouter(0, fakeAccess{writeErr: ErrBlocked}), "/api/conversations/dm1/tts", "oi"); rec.Code != http.StatusForbidden {
		t.Fatalf("bloqueado: %d", rec.Code)
	}
}
