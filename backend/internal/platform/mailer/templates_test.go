package mailer

import (
	"net/mail"
	"os"
	"strings"
	"testing"
	"time"
)

func TestVerifyEmailContainsLinkAndName(t *testing.T) {
	m, err := VerifyEmail("a@b.co", "Ana <b>", "https://app.exemplo.com/", "tok/en+1", 24*time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	wantURL := "https://app.exemplo.com/verify-email?token=tok%2Fen%2B1"
	if !strings.Contains(m.HTML, wantURL) || !strings.Contains(m.Text, wantURL) {
		t.Fatalf("link ausente: %s", m.Text)
	}
	if strings.Contains(m.HTML, "<b>") {
		t.Fatal("nome não foi escapado no HTML")
	}
	if !strings.Contains(m.Text, "24 horas") {
		t.Fatalf("validade ausente: %s", m.Text)
	}
}

func TestResetPasswordLifetime(t *testing.T) {
	m, err := ResetPassword("a@b.co", "Ana", "https://x.io", "t", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(m.Text, "1 hora") || !strings.Contains(m.HTML, "/reset-password?token=t") {
		t.Fatalf("conteúdo inesperado: %s", m.Text)
	}
}

// MAILER_PREVIEW_DIR=dir go test ./internal/mailer -run Preview grava os HTMLs
// para abrir no navegador.
func TestPreview(t *testing.T) {
	dir := os.Getenv("MAILER_PREVIEW_DIR")
	if dir == "" {
		t.Skip("MAILER_PREVIEW_DIR não definido")
	}
	v, _ := VerifyEmail("a@b.co", "Hugo", "https://salinha.app", "abc123", 24*time.Hour)
	r, _ := ResetPassword("a@b.co", "Hugo", "https://salinha.app", "abc123", time.Hour)
	for name, m := range map[string]Message{"verify.html": v, "reset.html": r} {
		if err := os.WriteFile(dir+"/"+name, []byte(m.HTML), 0o644); err != nil {
			t.Fatal(err)
		}
	}
}

func TestMessageEmbedsIconAndBuildsMIME(t *testing.T) {
	m, err := VerifyEmail("a@b.co", "Ana", "https://x.io", "t", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(m.HTML, `src="cid:salinha-icon"`) || len(m.Inline) != 1 || len(m.Inline[0].Data) == 0 {
		t.Fatal("ícone não embutido")
	}
	raw, err := buildMessage(&mail.Address{Address: "n@x.com"}, &mail.Address{Address: "a@b.co"}, m)
	if err != nil {
		t.Fatal(err)
	}
	s := string(raw)
	for _, want := range []string{"multipart/alternative", "multipart/related", "Content-Id: <salinha-icon>", "text/plain", "text/html"} {
		if !strings.Contains(s, want) {
			t.Errorf("MIME sem %q", want)
		}
	}
}
