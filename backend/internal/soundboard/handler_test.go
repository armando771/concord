package soundboard

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"gin-quickstart/backend/internal/permission"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"
	"time"

	"gin-quickstart/backend/internal/platform/media"

	"github.com/gin-gonic/gin"
)

type fakeRepo struct {
	sounds map[string]Sound
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{sounds: make(map[string]Sound)}
}

func (r *fakeRepo) Create(_ context.Context, s *Sound) error {
	s.CreatedAt = time.Now().UTC()
	s.UploaderName = "Alice"
	r.sounds[s.ID] = *s
	return nil
}

func (r *fakeRepo) ListByServer(_ context.Context, serverID string) ([]Sound, error) {
	out := make([]Sound, 0)
	for _, s := range r.sounds {
		if s.ServerID == serverID {
			out = append(out, s)
		}
	}
	return out, nil
}

func (r *fakeRepo) FindByID(_ context.Context, id string) (*Sound, error) {
	s, ok := r.sounds[id]
	if !ok {
		return nil, ErrSoundNotFound
	}
	return &s, nil
}

func (r *fakeRepo) CountByServer(_ context.Context, serverID string) (int, error) {
	n := 0
	for _, s := range r.sounds {
		if s.ServerID == serverID {
			n++
		}
	}
	return n, nil
}

func (r *fakeRepo) Delete(_ context.Context, id string) error {
	if _, ok := r.sounds[id]; !ok {
		return ErrSoundNotFound
	}
	delete(r.sounds, id)
	return nil
}

type fakeServers struct {
	members      map[string]bool
	mods         map[string]bool
	noSoundboard map[string]bool
	noAddSounds  map[string]bool
}

func (f *fakeServers) IsMember(_ context.Context, _, userID string) (bool, error) {
	return f.members[userID], nil
}

// ServerPerms: membro comum tem as permissões padrão; mods também gerenciam
// os áudios dos outros; mudos (sem USE_SOUNDBOARD) não enviam.
func (f *fakeServers) ServerPerms(_ context.Context, _, userID string) (int64, error) {
	if !f.members[userID] {
		return 0, nil
	}
	perms := permission.DefaultEveryone
	if f.mods[userID] {
		perms |= permission.ManageExpressions
	}
	if f.noSoundboard[userID] {
		perms &^= permission.UseSoundboard
	}
	if f.noAddSounds[userID] {
		perms &^= permission.AddSounds
	}
	return perms, nil
}

type fakeSpace struct{ ok bool }

func (f fakeSpace) HasRoom(int64) bool { return f.ok }

type fakeTokens struct{ users map[string]string }

func (f fakeTokens) VerifyMediaToken(token string) (string, error) {
	u, ok := f.users[token]
	if !ok {
		return "", errors.New("invalid token")
	}
	return u, nil
}

type fakePublisher struct {
	events []string
}

func (p *fakePublisher) BroadcastToRoom(room string, event []byte) {
	p.events = append(p.events, room+":"+string(event))
}

func validWAV() []byte {
	return []byte("RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00")
}

func buildMultipart(t *testing.T, fields map[string]string, fileContent []byte, contentType string) (*bytes.Buffer, string) {
	t.Helper()
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	for k, v := range fields {
		if err := writer.WriteField(k, v); err != nil {
			t.Fatal(err)
		}
	}
	if fileContent != nil {
		hdr := make(textproto.MIMEHeader)
		hdr.Set("Content-Disposition", `form-data; name="file"; filename="horn.wav"`)
		hdr.Set("Content-Type", contentType)
		part, err := writer.CreatePart(hdr)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(fileContent); err != nil {
			t.Fatal(err)
		}
	}
	writer.Close()
	return body, writer.FormDataContentType()
}

func setupTestRouter(t *testing.T) (*gin.Engine, *Handler, *fakeRepo, *fakePublisher) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	store, err := media.NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	repo := newFakeRepo()
	srv := &fakeServers{
		members: map[string]bool{"user-1": true, "user-2": true, "user-3": true, "mod-1": true},
		mods:    map[string]bool{"mod-1": true},
		// user-2 perdeu ADD_SOUNDS; user-3 perdeu USE_SOUNDBOARD (mas ainda envia).
		noAddSounds:  map[string]bool{"user-2": true},
		noSoundboard: map[string]bool{"user-3": true},
	}
	tokens := fakeTokens{users: map[string]string{"tok-1": "user-1", "tok-outsider": "outsider"}}
	pub := &fakePublisher{}
	h := NewHandler(repo, store, fakeSpace{ok: true}, srv, srv, tokens, pub)

	r := gin.New()
	api := r.Group("/api")
	auth := func(c *gin.Context) {
		uid := c.GetHeader("X-User-ID")
		if uid != "" {
			c.Set("userID", uid)
		}
		c.Next()
	}
	Routes(api, h, auth)
	return r, h, repo, pub
}

func TestUploadAndServeSound(t *testing.T) {
	r, _, _, pub := setupTestRouter(t)

	body, ct := buildMultipart(t, map[string]string{
		"name":        "Buzina",
		"emoji":       "📯",
		"duration_ms": "2500",
	}, validWAV(), "audio/wav")

	req := httptest.NewRequest(http.MethodPost, "/api/servers/srv-1/soundboard", body)
	req.Header.Set("Content-Type", ct)
	req.Header.Set("X-User-ID", "user-1")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var created Sound
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.Name != "Buzina" || created.Emoji == nil || *created.Emoji != "📯" || created.DurationMs != 2500 {
		t.Fatalf("unexpected sound metadata: %+v", created)
	}
	if len(pub.events) != 1 {
		t.Fatalf("expected 1 broadcast event, got %d", len(pub.events))
	}

	// Serve file with valid member token
	getReq := httptest.NewRequest(http.MethodGet, "/api/soundboard/"+created.ID+"/file?token=tok-1", nil)
	getW := httptest.NewRecorder()
	r.ServeHTTP(getW, getReq)
	if getW.Code != http.StatusOK {
		t.Fatalf("expected 200 serving sound file, got %d", getW.Code)
	}

	// Quem não é do servidor também baixa: favorito tocado numa chamada de
	// outro servidor é ouvido por todos dela (o id do som é o acesso).
	outReq := httptest.NewRequest(http.MethodGet, "/api/soundboard/"+created.ID+"/file?token=tok-outsider", nil)
	outW := httptest.NewRecorder()
	r.ServeHTTP(outW, outReq)
	if outW.Code != http.StatusOK {
		t.Fatalf("expected 200 for non-member, got %d", outW.Code)
	}

	for name, url := range map[string]string{
		"token inválido":     "/api/soundboard/" + created.ID + "/file?token=nada",
		"sem token":          "/api/soundboard/" + created.ID + "/file",
		"som que não existe": "/api/soundboard/33333333-3333-3333-3333-333333333333/file?token=tok-1",
	} {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, url, nil))
		if w.Code == http.StatusOK {
			t.Errorf("%s: status 200, want recusa", name)
		}
	}
}

func TestUploadRejectsNonAudioAndInvalidLimits(t *testing.T) {
	r, h, _, _ := setupTestRouter(t)

	// PNG disguised as audio/mp3
	pngBytes := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR")
	body, ct := buildMultipart(t, map[string]string{
		"name":        "Fake",
		"duration_ms": "1000",
	}, pngBytes, "audio/mpeg")
	req := httptest.NewRequest(http.MethodPost, "/api/servers/srv-1/soundboard", body)
	req.Header.Set("Content-Type", ct)
	req.Header.Set("X-User-ID", "user-1")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("expected 415 for PNG disguised as audio, got %d", w.Code)
	}

	// Duration > 15s
	bodyDur, ctDur := buildMultipart(t, map[string]string{
		"name":        "Long",
		"duration_ms": "20000",
	}, validWAV(), "audio/wav")
	reqDur := httptest.NewRequest(http.MethodPost, "/api/servers/srv-1/soundboard", bodyDur)
	reqDur.Header.Set("Content-Type", ctDur)
	reqDur.Header.Set("X-User-ID", "user-1")
	wDur := httptest.NewRecorder()
	r.ServeHTTP(wDur, reqDur)
	if wDur.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for duration > 15s, got %d", wDur.Code)
	}

	// File too large
	h.maxSoundBytes = 16
	bodyBig, ctBig := buildMultipart(t, map[string]string{
		"name":        "Big",
		"duration_ms": "1000",
	}, validWAV(), "audio/wav")
	reqBig := httptest.NewRequest(http.MethodPost, "/api/servers/srv-1/soundboard", bodyBig)
	reqBig.Header.Set("Content-Type", ctBig)
	reqBig.Header.Set("X-User-ID", "user-1")
	wBig := httptest.NewRecorder()
	r.ServeHTTP(wBig, reqBig)
	if wBig.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413 for oversized audio, got %d", wBig.Code)
	}
}

func TestDeletePermissions(t *testing.T) {
	r, _, repo, _ := setupTestRouter(t)

	soundID := "11111111-1111-1111-1111-111111111111"
	repo.sounds[soundID] = Sound{
		ID:         soundID,
		ServerID:   "srv-1",
		UploaderID: "user-1",
		Name:       "Som 1",
		DurationMs: 1000,
	}

	// Regular user-2 (not uploader, not moderator) -> 403
	req1 := httptest.NewRequest(http.MethodDelete, "/api/servers/srv-1/soundboard/"+soundID, nil)
	req1.Header.Set("X-User-ID", "user-2")
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for other member, got %d", w1.Code)
	}

	// Moderator can delete -> 200
	req2 := httptest.NewRequest(http.MethodDelete, "/api/servers/srv-1/soundboard/"+soundID, nil)
	req2.Header.Set("X-User-ID", "mod-1")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200 for moderator delete, got %d: %s", w2.Code, w2.Body.String())
	}
}

func postSound(t *testing.T, r *gin.Engine, userID string) *httptest.ResponseRecorder {
	t.Helper()
	body, contentType := buildMultipart(t, map[string]string{"name": "Corneta", "duration_ms": "1500"}, validWAV(), "audio/wav")
	req := httptest.NewRequest(http.MethodPost, "/api/servers/srv-1/soundboard", body)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-User-ID", userID)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestUploadRequiresAddSounds(t *testing.T) {
	r, _, repo, _ := setupTestRouter(t)
	w := postSound(t, r, "user-2")
	if w.Code != http.StatusForbidden || !strings.Contains(w.Body.String(), "missing_permission") ||
		!strings.Contains(w.Body.String(), ErrCannotAddSound.Error()) {
		t.Fatalf("status = %d (%s), want 403 missing_permission com a mensagem clara", w.Code, w.Body.String())
	}
	if len(repo.sounds) != 0 {
		t.Fatal("o áudio não devia ser salvo")
	}
}

// Adicionar sons não depende de usar a mesa (como no Discord).
func TestUploadWithoutUseSoundboardButWithAddSounds(t *testing.T) {
	r, _, _, _ := setupTestRouter(t)
	if w := postSound(t, r, "user-3"); w.Code != http.StatusCreated {
		t.Fatalf("status = %d (%s), want 201", w.Code, w.Body.String())
	}
}
