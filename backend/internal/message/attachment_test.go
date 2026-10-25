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
