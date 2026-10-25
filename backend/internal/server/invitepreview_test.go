package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"sort"
	"testing"
	"time"

	"gin-quickstart/backend/internal/database"
	"gin-quickstart/backend/internal/ratelimit"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type fakePreviewer struct {
	preview *InvitePreview
	err     error
	codes   []string
}

func (f *fakePreviewer) InvitePreview(_ context.Context, code string) (*InvitePreview, error) {
	f.codes = append(f.codes, code)
	return f.preview, f.err
}

func previewRouter(previewer InvitePreviewer, limiter *ratelimit.Limiter) *gin.Engine {
	gin.SetMode(gin.TestMode)
	h := &Handler{previews: previewer}
	router := gin.New()
	router.GET("/invites/:id/preview", limitByIP(limiter, "too many requests"), h.InvitePreview)
	return router
}

func getPreview(router *gin.Engine, code, ip string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/invites/"+code+"/preview", nil)
	req.RemoteAddr = ip + ":1234"
	router.ServeHTTP(w, req)
	return w
}

func TestInvitePreviewReturnsOnlyPublicFields(t *testing.T) {
	icon := "https://exemplo.com/icone.png"
	fake := &fakePreviewer{preview: &InvitePreview{
		ServerID:    "srv-1",
		Name:        "Turma",
		IconURL:     &icon,
		MemberCount: 12,
		OnlineCount: 3,
	}}
	w := getPreview(previewRouter(fake, ratelimit.New(10, time.Minute, 100)), "abcd2345", "203.0.113.1")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (%s)", w.Code, w.Body.String())
	}
	if len(fake.codes) != 1 || fake.codes[0] != "abcd2345" {
		t.Errorf("código repassado = %v, want [abcd2345]", fake.codes)
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	keys := make([]string, 0, len(body))
	for k := range body {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	want := []string{"icon_url", "member_count", "name", "online_count", "server_id"}
	if len(keys) != len(want) {
		t.Fatalf("campos = %v, want %v", keys, want)
	}
	for i := range want {
		if keys[i] != want[i] {
			t.Fatalf("campos = %v, want %v", keys, want)
		}
	}
	if body["member_count"] != float64(12) || body["online_count"] != float64(3) {
		t.Errorf("contagens = %v/%v, want 12/3", body["member_count"], body["online_count"])
	}
}

func TestInvitePreviewUnknownCodeIs404(t *testing.T) {
	fake := &fakePreviewer{err: ErrInvalidCode}
	w := getPreview(previewRouter(fake, ratelimit.New(10, time.Minute, 100)), "NAOEXISTE", "203.0.113.1")
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", w.Code)
	}
}

func TestInvitePreviewInternalErrorIs500(t *testing.T) {
	fake := &fakePreviewer{err: errors.New("banco fora")}
	w := getPreview(previewRouter(fake, ratelimit.New(10, time.Minute, 100)), "ABCD2345", "203.0.113.1")
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}
	if body := w.Body.String(); body == "" || json.Valid([]byte(body)) == false {
		t.Errorf("body = %q, want JSON", body)
	}
}

func TestInvitePreviewIsRateLimitedPerIP(t *testing.T) {
	fake := &fakePreviewer{err: ErrInvalidCode}
	router := previewRouter(fake, ratelimit.New(2, time.Minute, 100))

	for i := 0; i < 2; i++ {
		if w := getPreview(router, "ABCD2345", "203.0.113.1"); w.Code != http.StatusNotFound {
			t.Fatalf("pedido %d: status = %d, want 404", i+1, w.Code)
		}
	}
	w := getPreview(router, "ABCD2345", "203.0.113.1")
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("3º pedido: status = %d, want 429", w.Code)
	}
	if w.Header().Get("Retry-After") == "" {
		t.Error("429 sem Retry-After")
	}
	if len(fake.codes) != 2 {
		t.Errorf("bloqueado ainda consultou o código: %d consultas", len(fake.codes))
	}
	// Outro IP tem a própria cota.
	if w := getPreview(router, "ABCD2345", "203.0.113.2"); w.Code != http.StatusNotFound {
		t.Fatalf("outro IP: status = %d, want 404", w.Code)
	}
}

func TestValidInviteCode(t *testing.T) {
	for _, code := range []string{"ABCD2345", "K7P2QX9M", "ABCD", "ABCDEFGHJK234567"} {
		if !validInviteCode(code) {
			t.Errorf("validInviteCode(%q) = false, want true", code)
		}
	}
	for _, code := range []string{"", "ABC", "ABCDEFGHJK2345678", "ABCD 2345", "ABCD/2345", "abcd2345", "ÁBCD2345", "ABCD%00"} {
		if validInviteCode(code) {
			t.Errorf("validInviteCode(%q) = true, want false", code)
		}
	}
}

func TestCountOnlineIgnoresOfflineAndInvisible(t *testing.T) {
	statuses := map[string]string{"a": "online", "b": "offline", "c": "idle", "d": "dnd"}
	presence := func(ids []string) map[string]string {
		out := map[string]string{}
		for _, id := range ids {
			if s, ok := statuses[id]; ok {
				out[id] = s
			} else {
				out[id] = "offline"
			}
		}
		return out
	}
	if got := countOnline([]string{"a", "b", "c", "d", "e"}, presence); got != 3 {
		t.Errorf("countOnline = %d, want 3", got)
	}
	if got := countOnline([]string{"a"}, nil); got != 0 {
		t.Errorf("sem presença: countOnline = %d, want 0", got)
	}
}

func TestServiceInvitePreviewRejectsMalformedCodeWithoutDB(t *testing.T) {
	// Sem repositório: um código malformado não pode chegar ao banco.
	s := &Service{}
	for _, code := range []string{"", "x", "ABCD/../2345", "ABCDEFGHJK2345678"} {
		if _, err := s.InvitePreview(context.Background(), code); !errors.Is(err, ErrInvalidCode) {
			t.Errorf("InvitePreview(%q) err = %v, want ErrInvalidCode", code, err)
		}
	}
}

// Num Postgres de verdade (TEST_DATABASE_URL, banco descartável).
func TestInvitePreviewDB(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL não definido")
	}
	ctx := context.Background()
	db, err := database.Connect(url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(db, "../../migrations"); err != nil {
		t.Fatal(err)
	}

	owner, member, serverID := uuid.NewString(), uuid.NewString(), uuid.NewString()
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	for _, id := range []string{owner, member} {
		name := "u" + id[:8]
		exec(`INSERT INTO users (id, username, display_name, email, password_hash) VALUES ($1, $2::text, $2::text, $2::text || '@ex.com', 'x')`, id, name)
	}
	t.Cleanup(func() {
		db.Exec(ctx, `DELETE FROM servers WHERE id = $1`, serverID)
		db.Exec(ctx, `DELETE FROM users WHERE id IN ($1, $2)`, owner, member)
	})
	code := newInviteCode()
	exec(`INSERT INTO servers (id, name, icon_url, owner_id, invite_code) VALUES ($1, 'Turma', 'https://ex.com/i.png', $2, $3)`, serverID, owner, code)
	exec(`INSERT INTO server_members (server_id, user_id) VALUES ($1, $2), ($1, $3)`, serverID, owner, member)

	s := ServerService(ServerRepository(db), nil, nil)
	s.SetPresence(func(ids []string) map[string]string {
		out := map[string]string{}
		for _, id := range ids {
			out[id] = "offline"
		}
		out[member] = "online"
		return out
	})

	p, err := s.InvitePreview(ctx, " "+code[:4]+"-"+code[4:]+" ")
	if err != nil {
		t.Fatal(err)
	}
	if p.ServerID != serverID || p.Name != "Turma" || p.IconURL == nil || *p.IconURL != "https://ex.com/i.png" {
		t.Errorf("preview = %+v", p)
	}
	if p.MemberCount != 2 || p.OnlineCount != 1 {
		t.Errorf("contagens = %d/%d, want 2/1", p.MemberCount, p.OnlineCount)
	}

	if _, err := s.InvitePreview(ctx, "ZZZZZZZZ"); !errors.Is(err, ErrInvalidCode) {
		t.Errorf("código que não existe: err = %v, want ErrInvalidCode", err)
	}
}

// A prévia é pública: as rotas reais registram sem passar pelo login (e sem
// conflitar com as outras rotas de /invites no gin).
func TestInvitePreviewRouteSkipsAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	denyAll := func(c *gin.Context) { c.AbortWithStatus(http.StatusUnauthorized) }
	ServerRoutes(router.Group("/api"), &Handler{previews: &fakePreviewer{err: ErrInvalidCode}}, denyAll, denyAll)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/invites/ABCD2345/preview", nil))
	if w.Code != http.StatusNotFound {
		t.Fatalf("prévia: status = %d, want 404 (sem login)", w.Code)
	}
	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/invites", nil))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("lista de convites: status = %d, want 401", w.Code)
	}
}
