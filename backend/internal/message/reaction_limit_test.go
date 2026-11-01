package message

import (
	"errors"
	"net/http"
	"testing"
)

func TestCanAddReaction(t *testing.T) {
	cases := []struct {
		name     string
		distinct int
		present  bool
		want     bool
	}{
		{"mensagem sem reação", 0, false, true},
		{"19 diferentes: a 20ª entra", MaxDistinctReactions - 1, false, true},
		{"20 diferentes: a 21ª não entra", MaxDistinctReactions, false, false},
		{"20 diferentes: emoji que já está continua valendo", MaxDistinctReactions, true, true},
		{"dados antigos acima do limite: emoji que já está vale", MaxDistinctReactions + 5, true, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := canAddReaction(tc.distinct, tc.present); got != tc.want {
				t.Fatalf("canAddReaction(%d, %v) = %v, quero %v", tc.distinct, tc.present, got, tc.want)
			}
		})
	}
}

func TestReactionErrorResponseTooMany(t *testing.T) {
	status, body := reactionErrorResponse(ErrTooManyReactions, "failed to add reaction")
	if status != http.StatusConflict {
		t.Fatalf("status = %d, quero 409", status)
	}
	if body["code"] != "too_many_reactions" {
		t.Fatalf("code = %v, quero too_many_reactions", body["code"])
	}
	if body["max"] != MaxDistinctReactions {
		t.Fatalf("max = %v, quero %d", body["max"], MaxDistinctReactions)
	}
	// O erro chega embrulhado pelo repositório/service: errors.Is ainda acha.
	wrapped := errors.Join(errors.New("reagir"), ErrTooManyReactions)
	if status, _ := reactionErrorResponse(wrapped, ""); status != http.StatusConflict {
		t.Fatalf("erro embrulhado: status = %d, quero 409", status)
	}
}
