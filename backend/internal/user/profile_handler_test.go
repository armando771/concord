package user

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"gin-quickstart/backend/internal/platform/media"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

const meID = "11111111-1111-4111-8111-111111111111"
const otherID = "22222222-2222-4222-8222-222222222222"

type fakeProfileRepo struct {
	users map[string]*User
}

func (r *fakeProfileRepo) find(id string) (*User, error) {
	u, ok := r.users[id]
	if !ok {
		return nil, pgx.ErrNoRows
	}
	return u, nil
}

func (r *fakeProfileRepo) FindByID(_ context.Context, id string) (*User, error) {
	u, err := r.find(id)
	if err != nil {
		return nil, err
	}
	copied := *u
	return &copied, nil
}

func (r *fakeProfileRepo) UpdateProfile(_ context.Context, id string, in ProfileInput) (*User, error) {
	u, err := r.find(id)
	if err != nil {
		return nil, err
	}
	u.DisplayName, u.Pronouns, u.Bio, u.StatusText = in.DisplayName, in.Pronouns, in.Bio, in.StatusText
	u.BannerColor, u.Links = in.BannerColor, in.Links
	if in.NameStyle != nil {
		u.NameStyle = *in.NameStyle
	}
	if in.ProfileTheme != nil {
		u.ProfileTheme = *in.ProfileTheme
	}
	copied := *u
	return &copied, nil
}

func (r *fakeProfileRepo) swap(id string, field **string, url *string) (*User, *string, error) {
	old := *field
	*field = url
	copied := *r.users[id]
	return &copied, old, nil
}

func (r *fakeProfileRepo) SetAvatar(_ context.Context, id string, url *string) (*User, *string, error) {
	u, err := r.find(id)
	if err != nil {
		return nil, nil, err
	}
	return r.swap(id, &u.AvatarURL, url)
}

func (r *fakeProfileRepo) SetBanner(_ context.Context, id string, url *string) (*User, *string, error) {
	u, err := r.find(id)
	if err != nil {
		return nil, nil, err
	}
	return r.swap(id, &u.BannerURL, url)
}

func (r *fakeProfileRepo) SetStatus(_ context.Context, id string, status string) (*User, error) {
	u, err := r.find(id)
	if err != nil {
		return nil, err
	}
	u.Status = status
	copied := *u
	return &copied, nil
}

type fakeEvents struct {
	published []PublicProfile
	statuses  map[string]string
}

func (e *fakeEvents) PublishUserUpdate(p PublicProfile) { e.published = append(e.published, p) }
func (e *fakeEvents) SetUserStatus(id, status string)   { e.statuses[id] = status }
func (e *fakeEvents) EffectiveStatus(id string) string {
	return EffectiveStatus(e.statuses[id], true)
}

type fakeSpace struct{ ok bool }

func (s fakeSpace) HasRoom(int64) bool { return s.ok }

type profileEnv struct {
	router *gin.Engine
	h      *ProfileHandler
	repo   *fakeProfileRepo
	events *fakeEvents
	store  *media.Store
	static *media.Store
	dir    string
}

func newProfileEnv(t *testing.T) *profileEnv {
	t.Helper()
	gin.SetMode(gin.TestMode)
	dir := t.TempDir()
	store, err := media.NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	static, err := media.NewStore(filepath.Join(dir, "static"))
	if err != nil {
		t.Fatal(err)
	}
	repo := &fakeProfileRepo{users: map[string]*User{
		meID:    {ID: meID, Username: "mugis", DisplayName: "Mugis", Email: "m@x.com", Status: StatusOnline, Links: []ProfileLink{}},
		otherID: {ID: otherID, Username: "baal", DisplayName: "Baal", Email: "b@x.com", Status: StatusInvisible, Links: []ProfileLink{}},
	}}
	events := &fakeEvents{statuses: map[string]string{otherID: StatusInvisible}}
	h := NewProfileHandler(NewProfileService(repo, events), store, static, fakeSpace{ok: true})
	h.maxBytes = 1024
	router := gin.New()
	fakeAuth := func(c *gin.Context) {
		c.Set("userID", meID)
		c.Next()
	}
	ProfileRoutes(router.Group("/api"), h, fakeAuth)
	return &profileEnv{router: router, h: h, repo: repo, events: events, store: store, static: static, dir: dir}
}

func (e *profileEnv) do(t *testing.T, method, path string, body []byte, contentType string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	rec := httptest.NewRecorder()
	e.router.ServeHTTP(rec, req)
	return rec
}

func (e *profileEnv) upload(t *testing.T, path string, parts map[string][]byte) *httptest.ResponseRecorder {
	t.Helper()
	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	for name, data := range parts {
		part, err := w.CreateFormFile(name, name+".bin")
		if err != nil {
			t.Fatal(err)
		}
		part.Write(data)
	}
	w.Close()
	return e.do(t, http.MethodPost, path, body.Bytes(), w.FormDataContentType())
}

func (e *profileEnv) fileCount(t *testing.T, store *media.Store) int {
	t.Helper()
	files, err := store.List()
	if err != nil {
		t.Fatal(err)
	}
	return len(files)
}

func decodeUser(t *testing.T, rec *httptest.ResponseRecorder) User {
	t.Helper()
	var u User
	if err := json.Unmarshal(rec.Body.Bytes(), &u); err != nil {
		t.Fatalf("resposta não é usuário: %s", rec.Body.String())
	}
	return u
}

func pngData() []byte  { return append([]byte("\x89PNG\r\n\x1a\n"), bytes.Repeat([]byte{1}, 100)...) }
func gifData() []byte  { return append([]byte("GIF89a"), bytes.Repeat([]byte{2}, 100)...) }
func webpData() []byte { return append([]byte("RIFF\x00\x00\x00\x00WEBPVP8 "), bytes.Repeat([]byte{3}, 100)...) }

func TestUpdateProfilePublishesOnce(t *testing.T) {
	e := newProfileEnv(t)
	body := `{"display_name":" Mugis RX ","bio":"oi","pronouns":"ele/dele","status_text":"Anime favorito?","banner_color":"#5865F2","links":[{"url":"https://twitch.tv/mugis_rx"}]}`
	rec := e.do(t, http.MethodPut, "/api/users/me/profile", []byte(body), "application/json")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body.String())
	}
	u := decodeUser(t, rec)
	if u.DisplayName != "Mugis RX" || u.Bio != "oi" || u.BannerColor == nil || *u.BannerColor != "#5865f2" || len(u.Links) != 1 {
		t.Fatalf("usuário = %+v", u)
	}
	if len(e.events.published) != 1 || e.events.published[0].DisplayName != "Mugis RX" {
		t.Fatalf("eventos = %+v", e.events.published)
	}
	if strings.Contains(mustJSON(t, e.events.published[0]), "m@x.com") {
		t.Fatal("o evento público não pode levar o e-mail")
	}
}

func TestUpdateProfileInvalidDoesNotPublish(t *testing.T) {
	e := newProfileEnv(t)
	rec := e.do(t, http.MethodPut, "/api/users/me/profile", []byte(`{"display_name":"","links":[]}`), "application/json")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", rec.Code)
	}
	rec = e.do(t, http.MethodPut, "/api/users/me/profile", []byte(`{"display_name":"x","links":[{"url":"javascript:alert(1)"}]}`), "application/json")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", rec.Code)
	}
	if len(e.events.published) != 0 {
		t.Fatalf("não devia publicar: %+v", e.events.published)
	}
}

func TestGetProfileHidesEmailAndInvisible(t *testing.T) {
	e := newProfileEnv(t)
	rec := e.do(t, http.MethodGet, "/api/users/"+otherID+"/profile", nil, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "b@x.com") || strings.Contains(rec.Body.String(), "email") {
		t.Fatalf("perfil público com e-mail: %s", rec.Body.String())
	}
	var p PublicProfile
	json.Unmarshal(rec.Body.Bytes(), &p)
	if p.Status != StatusOffline {
		t.Fatalf("invisível deveria aparecer offline, veio %q", p.Status)
	}

	e.repo.users[meID].Status = StatusInvisible
	rec = e.do(t, http.MethodGet, "/api/users/"+meID+"/profile", nil, "")
	json.Unmarshal(rec.Body.Bytes(), &p)
	if p.Status != StatusInvisible {
		t.Fatalf("a própria pessoa vê o status escolhido, veio %q", p.Status)
	}
}

func TestGetProfileNotFound(t *testing.T) {
	e := newProfileEnv(t)
	for _, id := range []string{"33333333-3333-4333-8333-333333333333", "nao-e-uuid"} {
		if rec := e.do(t, http.MethodGet, "/api/users/"+id+"/profile", nil, ""); rec.Code != http.StatusNotFound {
			t.Fatalf("%s: status = %d", id, rec.Code)
		}
	}
}

func TestUploadPNGAvatar(t *testing.T) {
	e := newProfileEnv(t)
	rec := e.upload(t, "/api/users/me/avatar", map[string][]byte{"file": pngData()})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body.String())
	}
	u := decodeUser(t, rec)
	if u.AvatarURL == nil || strings.Contains(*u.AvatarURL, "a_") || !strings.HasPrefix(*u.AvatarURL, "/api/profile-media/") {
		t.Fatalf("avatar_url = %v", u.AvatarURL)
	}
	if e.fileCount(t, e.store) != 1 || e.fileCount(t, e.static) != 0 {
		t.Fatal("PNG grava só o arquivo, sem quadro parado")
	}
	if len(e.events.published) != 1 {
		t.Fatal("upload deveria publicar o perfil novo")
	}
}

func TestUploadPNGDropsStatic(t *testing.T) {
	e := newProfileEnv(t)
	rec := e.upload(t, "/api/users/me/avatar", map[string][]byte{"file": pngData(), "static": webpData()})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if e.fileCount(t, e.static) != 0 {
		t.Fatal("imagem parada não precisa de quadro estático")
	}
}

func TestUploadGIFAvatarIsAnimated(t *testing.T) {
	e := newProfileEnv(t)
	rec := e.upload(t, "/api/users/me/avatar", map[string][]byte{"file": gifData(), "static": webpData()})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body.String())
	}
	u := decodeUser(t, rec)
	if u.AvatarURL == nil || !strings.HasPrefix(*u.AvatarURL, "/api/profile-media/a_") {
		t.Fatalf("GIF deveria ganhar o prefixo a_: %v", u.AvatarURL)
	}
	if e.fileCount(t, e.store) != 1 || e.fileCount(t, e.static) != 1 {
		t.Fatal("GIF grava arquivo e quadro parado")
	}
}

func TestUploadGIFWithoutStatic(t *testing.T) {
	e := newProfileEnv(t)
	if rec := e.upload(t, "/api/users/me/avatar", map[string][]byte{"file": gifData()}); rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestUploadRejectsBadFiles(t *testing.T) {
	cases := map[string]struct {
		parts map[string][]byte
		want  int
	}{
		"texto disfarçado": {map[string][]byte{"file": []byte("isso não é imagem nenhuma")}, http.StatusUnsupportedMediaType},
		"vídeo":            {map[string][]byte{"file": append([]byte("\x00\x00\x00\x18ftypmp42"), make([]byte, 64)...)}, http.StatusUnsupportedMediaType},
		"static GIF":       {map[string][]byte{"file": gifData(), "static": gifData()}, http.StatusUnsupportedMediaType},
		"grande demais":    {map[string][]byte{"file": append(pngData(), make([]byte, 2048)...)}, http.StatusRequestEntityTooLarge},
		"sem arquivo":      {map[string][]byte{"outro": pngData()}, http.StatusBadRequest},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			e := newProfileEnv(t)
			rec := e.upload(t, "/api/users/me/avatar", tc.parts)
			if rec.Code != tc.want {
				t.Fatalf("status = %d, want %d: %s", rec.Code, tc.want, rec.Body.String())
			}
			if e.fileCount(t, e.store) != 0 || e.fileCount(t, e.static) != 0 {
				t.Fatal("upload recusado não pode deixar arquivo")
			}
			if e.repo.users[meID].AvatarURL != nil || len(e.events.published) != 0 {
				t.Fatal("upload recusado não muda o perfil")
			}
		})
	}
}

func TestUploadWithoutSpace(t *testing.T) {
	e := newProfileEnv(t)
	e.h.space = fakeSpace{ok: false}
	if rec := e.upload(t, "/api/users/me/avatar", map[string][]byte{"file": pngData()}); rec.Code != http.StatusInsufficientStorage {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestReplaceAndDeleteRemoveOldFiles(t *testing.T) {
	for _, kind := range []string{"avatar", "banner"} {
		t.Run(kind, func(t *testing.T) {
			e := newProfileEnv(t)
			path := "/api/users/me/" + kind
			e.upload(t, path, map[string][]byte{"file": gifData(), "static": webpData()})
			rec := e.upload(t, path, map[string][]byte{"file": pngData()})
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d", rec.Code)
			}
			if e.fileCount(t, e.store) != 1 || e.fileCount(t, e.static) != 0 {
				t.Fatal("trocar deveria apagar o arquivo e o quadro parado antigos")
			}

			rec = e.do(t, http.MethodDelete, path, nil, "")
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d", rec.Code)
			}
			u := decodeUser(t, rec)
			if u.AvatarURL != nil || u.BannerURL != nil {
				t.Fatalf("remover deveria zerar a URL: %+v", u)
			}
			if e.fileCount(t, e.store) != 0 {
				t.Fatal("remover deveria apagar o arquivo")
			}
		})
	}
}

func TestSetStatus(t *testing.T) {
	e := newProfileEnv(t)
	rec := e.do(t, http.MethodPut, "/api/users/me/status", []byte(`{"status":"dnd"}`), "application/json")
	if rec.Code != http.StatusOK || decodeUser(t, rec).Status != StatusDND {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body.String())
	}
	if e.events.statuses[meID] != StatusDND {
		t.Fatal("o hub deveria saber do status novo")
	}
	if rec := e.do(t, http.MethodPut, "/api/users/me/status", []byte(`{"status":"ocupado"}`), "application/json"); rec.Code != http.StatusBadRequest {
		t.Fatalf("status inválido = %d", rec.Code)
	}
}

func TestServeMediaIsPublicAndCached(t *testing.T) {
	e := newProfileEnv(t)
	rec := e.upload(t, "/api/users/me/avatar", map[string][]byte{"file": gifData(), "static": webpData()})
	url := *decodeUser(t, rec).AvatarURL

	rec = e.do(t, http.MethodGet, url, nil, "")
	if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "image/gif" {
		t.Fatalf("status = %d, type = %q", rec.Code, rec.Header().Get("Content-Type"))
	}
	if !strings.Contains(rec.Header().Get("Cache-Control"), "immutable") || rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("cabeçalhos = %v", rec.Header())
	}

	rec = e.do(t, http.MethodGet, url+"/static", nil, "")
	if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "image/webp" {
		t.Fatalf("static: status = %d, type = %q", rec.Code, rec.Header().Get("Content-Type"))
	}
}

func TestServeStaticFallsBackToFile(t *testing.T) {
	e := newProfileEnv(t)
	rec := e.upload(t, "/api/users/me/avatar", map[string][]byte{"file": pngData()})
	url := *decodeUser(t, rec).AvatarURL
	rec = e.do(t, http.MethodGet, url+"/static", nil, "")
	if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "image/png" {
		t.Fatalf("status = %d, type = %q", rec.Code, rec.Header().Get("Content-Type"))
	}
}

func TestServeMediaNotFound(t *testing.T) {
	e := newProfileEnv(t)
	for _, path := range []string{
		"/api/profile-media/..%2Fetc%2Fpasswd",
		"/api/profile-media/nao-e-uuid",
		"/api/profile-media/33333333-3333-4333-8333-333333333333",
		"/api/profile-media/a_33333333-3333-4333-8333-333333333333/static",
	} {
		if rec := e.do(t, http.MethodGet, path, nil, ""); rec.Code != http.StatusNotFound {
			t.Errorf("%s: status = %d", path, rec.Code)
		}
	}
}

func mustJSON(t *testing.T, v any) string {
	t.Helper()
	data, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

// As respostas de /me/* são da própria pessoa: o app guarda a resposta como a
// sessão, então o próprio e-mail continua indo (e só ele).
func TestOwnProfileResponsesKeepOwnEmail(t *testing.T) {
	e := newProfileEnv(t)
	responses := map[string]*httptest.ResponseRecorder{
		"PUT /me/profile":   e.do(t, http.MethodPut, "/api/users/me/profile", []byte(`{"display_name":"Mugis","links":[]}`), "application/json"),
		"PUT /me/status":    e.do(t, http.MethodPut, "/api/users/me/status", []byte(`{"status":"idle"}`), "application/json"),
		"POST /me/avatar":   e.upload(t, "/api/users/me/avatar", map[string][]byte{"file": pngData()}),
		"DELETE /me/avatar": e.do(t, http.MethodDelete, "/api/users/me/avatar", nil, ""),
	}
	for what, rec := range responses {
		if rec.Code != http.StatusOK {
			t.Errorf("%s: status = %d %s", what, rec.Code, rec.Body.String())
			continue
		}
		if !strings.Contains(rec.Body.String(), `"email":"m@x.com"`) {
			t.Errorf("%s perdeu o próprio e-mail: %s", what, rec.Body.String())
		}
		if strings.Contains(rec.Body.String(), "b@x.com") {
			t.Errorf("%s com e-mail de outra pessoa: %s", what, rec.Body.String())
		}
	}
}

func TestUpdateProfileNameStyle(t *testing.T) {
	e := newProfileEnv(t)
	body := `{"display_name":"Mugis","links":[],"name_style":{"font":"bit8","effect":"neon","colors":["#00FFAA"]}}`
	rec := e.do(t, http.MethodPut, "/api/users/me/profile", []byte(body), "application/json")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body.String())
	}
	u := decodeUser(t, rec)
	if u.NameStyle.Font != "bit8" || u.NameStyle.Effect != "neon" || u.NameStyle.Colors[0] != "#00ffaa" {
		t.Fatalf("name_style = %+v", u.NameStyle)
	}
	if e.events.published[0].NameStyle.Font != "bit8" {
		t.Fatalf("o evento público tem de levar o estilo: %+v", e.events.published[0])
	}

	// Cliente antigo (sem name_style) não apaga o estilo.
	rec = e.do(t, http.MethodPut, "/api/users/me/profile", []byte(`{"display_name":"Mugis","links":[]}`), "application/json")
	if rec.Code != http.StatusOK || decodeUser(t, rec).NameStyle.Font != "bit8" {
		t.Fatalf("estilo foi perdido: %s", rec.Body.String())
	}

	rec = e.do(t, http.MethodPut, "/api/users/me/profile", []byte(`{"display_name":"Mugis","links":[],"name_style":{"font":"x","effect":"solid","colors":[]}}`), "application/json")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestUpdateProfileTheme(t *testing.T) {
	e := newProfileEnv(t)
	body := `{"display_name":"Mugis","links":[],"profile_theme":{"border":"gradient","border_colors":["#FF0000","#0000ff"],"background":"solid","background_colors":["#FBCFE8"],"effect":"sparkles"}}`
	rec := e.do(t, http.MethodPut, "/api/users/me/profile", []byte(body), "application/json")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body.String())
	}
	u := decodeUser(t, rec)
	if u.ProfileTheme.Border != "gradient" || u.ProfileTheme.BorderColors[0] != "#ff0000" || u.ProfileTheme.BackgroundColors[0] != "#fbcfe8" || u.ProfileTheme.Effect != "sparkles" {
		t.Fatalf("profile_theme = %+v", u.ProfileTheme)
	}
	if e.events.published[0].ProfileTheme.Border != "gradient" {
		t.Fatalf("o evento público tem de levar o tema: %+v", e.events.published[0])
	}
	if !strings.Contains(rec.Body.String(), `"profile_theme":{"border":"gradient"`) {
		t.Fatalf("resposta sem profile_theme: %s", rec.Body.String())
	}

	// Cliente antigo (sem profile_theme) não apaga o tema.
	rec = e.do(t, http.MethodPut, "/api/users/me/profile", []byte(`{"display_name":"Mugis","links":[]}`), "application/json")
	if rec.Code != http.StatusOK || decodeUser(t, rec).ProfileTheme.Border != "gradient" {
		t.Fatalf("tema foi perdido: %s", rec.Body.String())
	}

	for _, bad := range []string{
		`{"border":"dotted","border_colors":[],"background":"default","background_colors":[],"effect":"none"}`,
		`{"border":"none","border_colors":[],"background":"solid","background_colors":["red"],"effect":"none"}`,
		`{"border":"none","border_colors":[],"background":"default","background_colors":[],"effect":"confetti"}`,
	} {
		rec = e.do(t, http.MethodPut, "/api/users/me/profile", []byte(`{"display_name":"Mugis","links":[],"profile_theme":`+bad+`}`), "application/json")
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("%s: status = %d, want 400", bad, rec.Code)
		}
	}
}

func TestServeGIFLoopsForever(t *testing.T) {
	e := newProfileEnv(t)
	finite := append([]byte(nil), netscapeLoop...)
	finite[16] = 2
	rec := e.upload(t, "/api/users/me/avatar", map[string][]byte{"file": tinyGIF(finite), "static": webpData()})
	url := *decodeUser(t, rec).AvatarURL

	rec = e.do(t, http.MethodGet, url, nil, "")
	if rec.Code != http.StatusOK || !bytes.Contains(rec.Body.Bytes(), netscapeLoop) {
		t.Fatalf("GIF entregue sem repetição infinita (status %d)", rec.Code)
	}
}
