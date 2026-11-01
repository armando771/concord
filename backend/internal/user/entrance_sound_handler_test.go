package user

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"gin-quickstart/backend/internal/platform/media"

	"github.com/gin-gonic/gin"
)

type entranceEnv struct {
	router *gin.Engine
	repo   *fakeProfileRepo
	events *fakeEvents
	store  *media.Store
}

func newEntranceEnv(t *testing.T, space spaceChecker) *entranceEnv {
	t.Helper()
	gin.SetMode(gin.TestMode)
	store, err := media.NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	repo := &fakeProfileRepo{users: map[string]*User{
		meID: {ID: meID, Username: "mugis", DisplayName: "Mugis", Status: StatusOnline, Links: []ProfileLink{}},
	}}
	events := &fakeEvents{statuses: map[string]string{}}
	h := NewEntranceSoundHandler(NewProfileService(repo, events), store, space)
	h.maxBytes = 1024
	router := gin.New()
	fakeAuth := func(c *gin.Context) {
		c.Set("userID", meID)
		c.Next()
	}
	EntranceSoundRoutes(router.Group("/api"), h, fakeAuth)
	return &entranceEnv{router: router, repo: repo, events: events, store: store}
}

func (e *entranceEnv) do(method, path string, body []byte, contentType string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	rec := httptest.NewRecorder()
	e.router.ServeHTTP(rec, req)
	return rec
}

func (e *entranceEnv) upload(durationMs string, body []byte) *httptest.ResponseRecorder {
	return e.do(http.MethodPost, "/api/users/me/entrance-sound?duration_ms="+durationMs, body, "audio/mpeg")
}

func (e *entranceEnv) files(t *testing.T) int {
	t.Helper()
	files, err := e.store.List()
	if err != nil {
		t.Fatal(err)
	}
	return len(files)
}

func mp3Data() []byte { return append([]byte("ID3\x04\x00"), bytes.Repeat([]byte{7}, 200)...) }

func TestEntranceSoundUploadGravaURLeArquivo(t *testing.T) {
	e := newEntranceEnv(t, fakeSpace{ok: true})
	rec := e.upload("3200", mp3Data())
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body.String())
	}
	u := decodeUser(t, rec)
	if u.EntranceSoundURL == nil || !strings.HasPrefix(*u.EntranceSoundURL, "/api/entrance-sounds/") {
		t.Fatalf("entrance_sound_url = %v", u.EntranceSoundURL)
	}
	if e.files(t) != 1 {
		t.Fatalf("arquivos = %d, quer 1", e.files(t))
	}
	if len(e.events.published) != 1 {
		t.Fatalf("perfil publicado %d vezes, quer 1", len(e.events.published))
	}
}

func TestEntranceSoundUploadTrocaApagaOAnterior(t *testing.T) {
	e := newEntranceEnv(t, fakeSpace{ok: true})
	first := decodeUser(t, e.upload("1000", mp3Data()))
	second := decodeUser(t, e.upload("2000", mp3Data()))
	if *first.EntranceSoundURL == *second.EntranceSoundURL {
		t.Fatal("a troca deveria gerar URL nova")
	}
	if e.files(t) != 1 {
		t.Fatalf("arquivos = %d, quer só o novo", e.files(t))
	}
}

func TestEntranceSoundUploadRecusa(t *testing.T) {
	cases := []struct {
		name     string
		space    bool
		duration string
		body     []byte
		status   int
	}{
		{"sem duração", true, "", mp3Data(), http.StatusBadRequest},
		{"duração não numérica", true, "abc", mp3Data(), http.StatusBadRequest},
		{"curto demais", true, "50", mp3Data(), http.StatusBadRequest},
		{"longo demais (mais de 5 s)", true, "5001", mp3Data(), http.StatusBadRequest},
		{"não é áudio", true, "1000", pngData(), http.StatusUnsupportedMediaType},
		{"vazio", true, "1000", nil, http.StatusUnsupportedMediaType},
		{"grande demais", true, "1000", append([]byte("ID3"), bytes.Repeat([]byte{1}, 2048)...), http.StatusRequestEntityTooLarge},
		{"servidor sem espaço", false, "1000", mp3Data(), http.StatusInsufficientStorage},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := newEntranceEnv(t, fakeSpace{ok: tc.space})
			rec := e.upload(tc.duration, tc.body)
			if rec.Code != tc.status {
				t.Fatalf("status = %d, quer %d: %s", rec.Code, tc.status, rec.Body.String())
			}
			if e.files(t) != 0 {
				t.Fatalf("sobrou %d arquivo(s) no disco", e.files(t))
			}
			if e.repo.users[meID].EntranceSoundURL != nil {
				t.Fatal("URL não deveria mudar")
			}
		})
	}
}

func TestEntranceSoundUploadUsuarioSumido(t *testing.T) {
	e := newEntranceEnv(t, fakeSpace{ok: true})
	delete(e.repo.users, meID)
	rec := e.upload("1000", mp3Data())
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, quer 404", rec.Code)
	}
	if e.files(t) != 0 {
		t.Fatal("o arquivo deveria ser apagado quando o perfil não grava")
	}
}

func TestEntranceSoundDeleteVoltaAoPadrao(t *testing.T) {
	e := newEntranceEnv(t, fakeSpace{ok: true})
	e.upload("1000", mp3Data())
	rec := e.do(http.MethodDelete, "/api/users/me/entrance-sound", nil, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body.String())
	}
	if u := decodeUser(t, rec); u.EntranceSoundURL != nil {
		t.Fatalf("entrance_sound_url = %v, quer vazio", *u.EntranceSoundURL)
	}
	if e.files(t) != 0 {
		t.Fatal("o arquivo antigo deveria ser apagado")
	}
}

func TestEntranceSoundDeleteUsuarioSumido(t *testing.T) {
	e := newEntranceEnv(t, fakeSpace{ok: true})
	delete(e.repo.users, meID)
	if rec := e.do(http.MethodDelete, "/api/users/me/entrance-sound", nil, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, quer 404", rec.Code)
	}
}

func TestEntranceSoundServe(t *testing.T) {
	e := newEntranceEnv(t, fakeSpace{ok: true})
	url := *decodeUser(t, e.upload("1000", mp3Data())).EntranceSoundURL

	rec := e.do(http.MethodGet, url, nil, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); ct != "audio/mpeg" {
		t.Fatalf("Content-Type = %q", ct)
	}
	if rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatal("falta nosniff")
	}
	if !bytes.Equal(rec.Body.Bytes(), mp3Data()) {
		t.Fatal("corpo diferente do enviado")
	}
}

func TestEntranceSoundServeNaoAchado(t *testing.T) {
	e := newEntranceEnv(t, fakeSpace{ok: true})
	for _, path := range []string{
		"/api/entrance-sounds/nao-e-uuid",
		"/api/entrance-sounds/" + otherID,
	} {
		if rec := e.do(http.MethodGet, path, nil, ""); rec.Code != http.StatusNotFound {
			t.Fatalf("%s: status = %d, quer 404", path, rec.Code)
		}
	}
}

func TestEntranceSoundServeRecusaArquivoQueNaoEAudio(t *testing.T) {
	e := newEntranceEnv(t, fakeSpace{ok: true})
	if _, _, err := e.store.Save(otherID, bytes.NewReader(pngData()), 1024); err != nil {
		t.Fatal(err)
	}
	if rec := e.do(http.MethodGet, "/api/entrance-sounds/"+otherID, nil, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, quer 404", rec.Code)
	}
}

func TestEntranceSoundIDFromURL(t *testing.T) {
	url := entranceSoundURL(otherID)
	if id, ok := entranceSoundIDFromURL(&url); !ok || id != otherID {
		t.Fatalf("id = %q, ok = %v", id, ok)
	}
	avatar := profileMediaURL(otherID, false)
	for _, u := range []*string{nil, &avatar} {
		if _, ok := entranceSoundIDFromURL(u); ok {
			t.Fatalf("%v não é URL de som de entrada", u)
		}
	}
}
