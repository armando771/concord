package message

import (
	"errors"
	"net/http"
	"testing"
)

func TestReactionErrorResponse(t *testing.T) {
	cases := []struct {
		name   string
		err    error
		status int
		code   string
	}{
		{"emoji inválido", ErrInvalidEmoji, http.StatusBadRequest, ""},
		{"conversa com bot", ErrBotConversation, http.StatusForbidden, "bot_conversation"},
		{"mensagem sumiu", ErrMessageNotFound, http.StatusNotFound, ""},
		{"erro do banco", errors.New("boom"), http.StatusInternalServerError, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status, body := reactionErrorResponse(tc.err, "failed to add reaction")
			if status != tc.status {
				t.Fatalf("status = %d, quero %d", status, tc.status)
			}
			if code, _ := body["code"].(string); code != tc.code {
				t.Fatalf("code = %q, quero %q", code, tc.code)
			}
		})
	}

	_, body := reactionErrorResponse(errors.New("detalhe interno"), "failed to add reaction")
	if body["error"] != "failed to add reaction" {
		t.Fatalf("erro inesperado não deve vazar o detalhe: %v", body["error"])
	}
}
