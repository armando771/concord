package message

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
)

func TestValidateNewMessage(t *testing.T) {
	eleven := make([]string, 11)
	for i := range eleven {
		eleven[i] = fmt.Sprintf("id-%d", i)
	}
	cases := []struct {
		name    string
		content string
		ids     []string
		want    error
	}{
		{"nada", "", nil, ErrContentRequired},
		{"só texto", "oi", nil, nil},
		{"só anexo", "", []string{"a"}, nil},
		{"texto e anexos", "olha", []string{"a", "b"}, nil},
		{"onze anexos", "", eleven, ErrTooManyAttachments},
		{"repetido", "", []string{"a", "a"}, ErrInvalidAttachment},
		{"id vazio", "", []string{""}, ErrInvalidAttachment},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateNewMessage(tc.content, tc.ids)
			if tc.want == nil && err != nil {
				t.Fatalf("err = %v, want nil", err)
			}
			if tc.want != nil && !errors.Is(err, tc.want) {
				t.Fatalf("err = %v, want %v", err, tc.want)
			}
		})
	}
}

func TestMessageJSONOmitsEmptyAttachments(t *testing.T) {
	raw, err := json.Marshal(Message{ID: "m"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "attachments") {
		t.Fatalf("mensagem sem anexo não deveria ter \"attachments\": %s", raw)
	}

	w := 640
	raw, err = json.Marshal(Message{ID: "m", Attachments: []Attachment{{ID: "a", Kind: "image", Width: &w}}})
	if err != nil {
		t.Fatal(err)
	}
	s := string(raw)
	if !strings.Contains(s, `"attachments"`) || !strings.Contains(s, `"width":640`) {
		t.Fatalf("faltou anexo/largura: %s", s)
	}
	if strings.Contains(s, "duration_ms") {
		t.Fatalf("duration_ms vazio deveria sumir: %s", s)
	}
}

func TestSanitizeFilename(t *testing.T) {
	cases := map[string]string{
		"foto.png":               "foto.png",
		"..\\..\\etc/passwd.png": "passwd.png",
		"  \x00a\x1fb.gif ":      "ab.gif",
		"":                       "arquivo",
	}
	for in, want := range cases {
		if got := sanitizeFilename(in); got != want {
			t.Fatalf("sanitizeFilename(%q) = %q, want %q", in, got, want)
		}
	}
	long := sanitizeFilename(strings.Repeat("á", 300) + ".png")
	if n := len([]rune(long)); n != 200 {
		t.Fatalf("nome longo ficou com %d runas, want 200", n)
	}
}

func TestParseOptionalPositive(t *testing.T) {
	if got := parseOptionalPositive("640", 16384); got == nil || *got != 640 {
		t.Fatalf("640 → %v", got)
	}
	for _, raw := range []string{"", "0", "-3", "x"} {
		if got := parseOptionalPositive(raw, 16384); got != nil {
			t.Fatalf("%q → %d, want nil", raw, *got)
		}
	}
	if got := parseOptionalPositive("20000", 16384); got != nil {
		t.Fatalf("acima do máximo → %d, want nil", *got)
	}
}
