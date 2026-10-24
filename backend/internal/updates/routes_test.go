package updates

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
)

func serve(t *testing.T, dir, path string) (int, string) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	Routes(router, dir)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	body, _ := io.ReadAll(rec.Body)
	return rec.Code, string(body)
}

func TestServesReleaseFiles(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "latest.yml"), []byte("version: 0.2.0\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	code, body := serve(t, dir, "/updates/latest.yml")

	if code != http.StatusOK || body != "version: 0.2.0\n" {
		t.Fatalf("status=%d body=%q", code, body)
	}
}

func TestDoesNotListDirectory(t *testing.T) {
	dir := t.TempDir()
	_ = os.WriteFile(filepath.Join(dir, "latest.yml"), []byte("x"), 0o644)

	if code, _ := serve(t, dir, "/updates/"); code == http.StatusOK {
		t.Fatalf("directory listing exposed (status %d)", code)
	}
}

func TestDoesNotEscapeDirectory(t *testing.T) {
	parent := t.TempDir()
	dir := filepath.Join(parent, "updates")
	_ = os.Mkdir(dir, 0o755)
	_ = os.WriteFile(filepath.Join(parent, ".env"), []byte("SECRET=1"), 0o644)

	if code, body := serve(t, dir, "/updates/../.env"); code == http.StatusOK || body == "SECRET=1" {
		t.Fatalf("path traversal served %q (status %d)", body, code)
	}
}
