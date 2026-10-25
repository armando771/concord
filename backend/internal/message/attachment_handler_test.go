package message

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"

	"gin-quickstart/backend/internal/media"

	"github.com/gin-gonic/gin"
)

type fakeAttachmentRepo struct {
	rows map[string]*storedAttachment
}

func (r *fakeAttachmentRepo) CreatePendingAttachment(_ context.Context, a *storedAttachment) error {
	copied := *a
	r.rows[a.ID] = &copied
	return nil
}

func (r *fakeAttachmentRepo) FindAttachment(_ context.Context, id string) (*storedAttachment, error) {
	a, ok := r.rows[id]
	if !ok {
		return nil, ErrAttachmentNotFound
	}
	return a, nil
}

type fakeAccess struct {
	readErr, writeErr error
}

func (a fakeAccess) CanRead(context.Context, Room, string) error  { return a.readErr }
func (a fakeAccess) CanWrite(context.Context, Room, string) error { return a.writeErr }

type fakeSpace struct{ ok bool }

func (s fakeSpace) HasRoom(int64) bool { return s.ok }

type attachmentEnv struct {
	router *gin.Engine
	h      *AttachmentHandler
	repo   *fakeAttachmentRepo
	store  *media.Store
}

func newAttachmentEnv(t *testing.T, access fakeAccess, space fakeSpace) *attachmentEnv {
	t.Helper()
	gin.SetMode(gin.TestMode)
	store, err := media.NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	repo := &fakeAttachmentRepo{rows: map[string]*storedAttachment{}}
	h := NewAttachmentHandler(repo, store, space, access, nil)
	router := gin.New()
	fakeAuth := func(c *gin.Context) {
		c.Set("userID", "u1")
		c.Next()
	}
	AttachmentRoutes(router.Group("/api"), h, fakeAuth)
	return &attachmentEnv{router: router, h: h, repo: repo, store: store}
}

// multipartBody monta o corpo do upload: campos e uma parte "file" com
// Content-Type explícito.
func multipartBody(t *testing.T, fields map[string]string, filename, contentType string, data []byte) (*bytes.Buffer, string) {
	t.Helper()
	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	for k, v := range fields {
		if err := w.WriteField(k, v); err != nil {
			t.Fatal(err)
		}
	}
	header := textproto.MIMEHeader{}
	header.Set("Content-Disposition", `form-data; name="file"; filename="`+strings.ReplaceAll(filename, `\`, `\\`)+`"`)
	header.Set("Content-Type", contentType)
	part, err := w.CreatePart(header)
	if err != nil {
		t.Fatal(err)
	}
	part.Write(data)
	w.Close()
	return body, w.FormDataContentType()
}

func pngBytes(n int) []byte {
	data := []byte("\x89PNG\r\n\x1a\n")
	return append(data, bytes.Repeat([]byte{0x42}, n-len(data))...)
}

func (e *attachmentEnv) upload(t *testing.T, path string, fields map[string]string, filename, contentType string, data []byte) *httptest.ResponseRecorder {
	t.Helper()
	body, ctype := multipartBody(t, fields, filename, contentType, data)
	req := httptest.NewRequest(http.MethodPost, path, body)
	req.Header.Set("Content-Type", ctype)
	rec := httptest.NewRecorder()
	e.router.ServeHTTP(rec, req)
	return rec
}

func (e *attachmentEnv) assertDiskEmpty(t *testing.T) {
	t.Helper()
	files, err := e.store.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 0 {
		t.Fatalf("disco deveria estar vazio, tem %+v", files)
	}
}

func TestUploadStoresImageAsPending(t *testing.T) {
	env := newAttachmentEnv(t, fakeAccess{}, fakeSpace{ok: true})
	data := pngBytes(108)
	rec := env.upload(t, "/api/channels/c1/attachments", map[string]string{"width": "640", "height": "480"}, "foto.png", "image/png", data)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var got Attachment
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Kind != "image" || got.ContentType != "image/png" || got.Width == nil || *got.Width != 640 || got.SizeBytes != int64(len(data)) {
		t.Fatalf("resposta = %+v", got)
	}
	row := env.repo.rows[got.ID]
	if row == nil || row.ChannelID == nil || *row.ChannelID != "c1" || row.ConversationID != nil || row.UploaderID != "u1" || row.MessageID != nil {
		t.Fatalf("linha = %+v", row)
	}
	f, err := env.store.Open(got.ID)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	saved, _ := io.ReadAll(f)
	if !bytes.Equal(saved, data) {
		t.Fatal("bytes salvos diferentes")
	}
}

func TestUploadToConversationSetsConversation(t *testing.T) {
	env := newAttachmentEnv(t, fakeAccess{}, fakeSpace{ok: true})
	rec := env.upload(t, "/api/conversations/d1/attachments", nil, "foto.png", "image/png", pngBytes(108))
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var got Attachment
	json.Unmarshal(rec.Body.Bytes(), &got)
	row := env.repo.rows[got.ID]
	if row == nil || row.ConversationID == nil || *row.ConversationID != "d1" || row.ChannelID != nil {
		t.Fatalf("linha = %+v", row)
	}
}

func TestUploadRejectsTooLarge(t *testing.T) {
	env := newAttachmentEnv(t, fakeAccess{}, fakeSpace{ok: true})
	env.h.maxFileBytes = 1024
	rec := env.upload(t, "/api/channels/c1/attachments", nil, "foto.png", "image/png", pngBytes(1025))
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	env.assertDiskEmpty(t)
}

func TestUploadRejectsDisguisedFile(t *testing.T) {
	env := newAttachmentEnv(t, fakeAccess{}, fakeSpace{ok: true})
	rec := env.upload(t, "/api/channels/c1/attachments", nil, "foto.png", "image/png", []byte(`<svg xmlns="http://www.w3.org/2000/svg"></svg>`))
	if rec.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	env.assertDiskEmpty(t)
	if len(env.repo.rows) != 0 {
		t.Fatal("não deveria gravar linha")
	}
}

func TestUploadRefusesWhenDiskLow(t *testing.T) {
	env := newAttachmentEnv(t, fakeAccess{}, fakeSpace{ok: false})
	rec := env.upload(t, "/api/channels/c1/attachments", nil, "foto.png", "image/png", pngBytes(108))
	if rec.Code != http.StatusInsufficientStorage || !strings.Contains(rec.Body.String(), "server out of space") {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	env.assertDiskEmpty(t)
}

func TestUploadRequiresWriteAccess(t *testing.T) {
	cases := []struct {
		err  error
		want int
	}{
		{ErrNoRoomAccess, http.StatusForbidden},
		{ErrRoomNotFound, http.StatusNotFound},
	}
	for _, tc := range cases {
		env := newAttachmentEnv(t, fakeAccess{writeErr: tc.err}, fakeSpace{ok: true})
		rec := env.upload(t, "/api/channels/c1/attachments", nil, "foto.png", "image/png", pngBytes(108))
		if rec.Code != tc.want {
			t.Fatalf("%v: status = %d, want %d", tc.err, rec.Code, tc.want)
		}
		if len(env.repo.rows) != 0 {
			t.Fatal("não deveria gravar linha")
		}
		env.assertDiskEmpty(t)
	}
}

func TestUploadKeepsCleanFilename(t *testing.T) {
	env := newAttachmentEnv(t, fakeAccess{}, fakeSpace{ok: true})
	data := append([]byte("OggS\x00\x02"), make([]byte, 64)...)
	rec := env.upload(t, "/api/channels/c1/attachments", nil, `..\..\x\voz.ogg`, "audio/ogg", data)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var got Attachment
	json.Unmarshal(rec.Body.Bytes(), &got)
	if got.Filename != "voz.ogg" || got.Kind != "audio" {
		t.Fatalf("resposta = %+v", got)
	}
}
