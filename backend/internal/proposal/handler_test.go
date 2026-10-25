package proposal

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"gin-quickstart/backend/internal/media"
)

// png1x1 é um PNG válido mínimo (o Sniff olha só os primeiros bytes).
var png1x1 = []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89")

func newTestRouter(t *testing.T) (*gin.Engine, *fakeStore) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	st, pub := newFakeStore(), &fakePublisher{}
	svc := newService(st, pub, nil, []string{"tech"})
	svc.now = func() time.Time { return t0 }
	store, err := media.NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	h := ProposalHandler(svc, store, media.NewSpace(t.TempDir(), 0))

	auth := func(c *gin.Context) {
		c.Set("userID", c.GetHeader("X-User"))
		c.Next()
	}
	pass := func(c *gin.Context) { c.Next() }
	r := gin.New()
	// Registrar as rotas já prova que não há conflito entre elas (o gin entra
	// em pânico no registro).
	ProposalRoutes(r.Group("/api"), h, auth, pass)
	return r, st
}

func upload(t *testing.T, r *gin.Engine, field, name string, data []byte) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	part, _ := w.CreateFormFile(field, name)
	part.Write(data)
	w.Close()
	req := httptest.NewRequest(http.MethodPost, "/api/proposal-media", &body)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("X-User", "u1")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

func TestImageUploadAndServe(t *testing.T) {
	r, st := newTestRouter(t)

	rec := upload(t, r, "file", "a.png", png1x1)
	if rec.Code != http.StatusCreated {
		t.Fatalf("upload: %d %s", rec.Code, rec.Body)
	}
	var img Image
	if err := json.Unmarshal(rec.Body.Bytes(), &img); err != nil || img.ID == "" || img.ContentType != "image/png" {
		t.Fatalf("resposta: %+v %v", img, err)
	}
	if fi, ok := st.images[img.ID]; !ok || fi.uploader != "u1" || fi.proposal != "" {
		t.Fatalf("a imagem deveria ficar pendente do uploader: %+v", st.images)
	}

	// Servir é público: sem X-User.
	get := httptest.NewRecorder()
	r.ServeHTTP(get, httptest.NewRequest(http.MethodGet, img.URL, nil))
	if get.Code != http.StatusOK || get.Header().Get("Content-Type") != "image/png" ||
		get.Header().Get("X-Content-Type-Options") != "nosniff" || !bytes.Equal(get.Body.Bytes(), png1x1) {
		t.Fatalf("servir: %d %v", get.Code, get.Header())
	}

	for name, rec := range map[string]*httptest.ResponseRecorder{
		"texto":        upload(t, r, "file", "a.txt", []byte("não sou imagem")),
		"svg":          upload(t, r, "file", "a.svg", []byte("<svg xmlns='http://www.w3.org/2000/svg'></svg>")),
		"campo errado": upload(t, r, "outro", "a.png", png1x1),
	} {
		if rec.Code == http.StatusCreated {
			t.Errorf("%s não deveria ser aceito: %s", name, rec.Body)
		}
	}
	if len(st.images) != 1 {
		t.Fatalf("uploads recusados não podem sobrar no banco: %d", len(st.images))
	}

	for _, path := range []string{"/api/proposal-media/nao-e-uuid", "/api/proposal-media/00000000-0000-4000-8000-000000000000"} {
		miss := httptest.NewRecorder()
		r.ServeHTTP(miss, httptest.NewRequest(http.MethodGet, path, nil))
		if miss.Code != http.StatusNotFound {
			t.Errorf("%s: %d", path, miss.Code)
		}
	}
}

func TestCreateEndpointRejectsBadImageIDs(t *testing.T) {
	r, _ := newTestRouter(t)
	body, _ := json.Marshal(map[string]any{"title": "Uma ideia", "image_ids": []string{"lixo"}})
	req := httptest.NewRequest(http.MethodPost, "/api/proposals", bytes.NewReader(body))
	req.Header.Set("X-User", "u1")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("image_ids inválido: %d %s", rec.Code, rec.Body)
	}
}
