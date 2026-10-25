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

func TestServesLinuxRelease(t *testing.T) {
	dir := t.TempDir()
	files := map[string]string{
		"latest-linux.yml":               "version: 0.7.0\npath: Salinha-0.7.0-x64.AppImage\n",
		"Salinha-0.7.0-x64.AppImage":     "appimage",
		"Salinha-0.7.0-x64.AppImage.sig": "assinatura",
	}
	gin.SetMode(gin.TestMode)
	router := gin.New()
	Routes(router, dir)
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
		for _, method := range []string{http.MethodGet, http.MethodHead} {
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, httptest.NewRequest(method, "/updates/"+name, nil))
			if rec.Code != http.StatusOK {
				t.Fatalf("%s %s: status=%d", method, name, rec.Code)
			}
			if method == http.MethodGet && rec.Body.String() != content {
				t.Fatalf("%s: body=%q", name, rec.Body.String())
			}
		}
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
