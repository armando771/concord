package call

import (
	"testing"
	"time"
)

// A lista de conectados sai de um map: sem ordenar, cada polling de
// /calls/active devolvia outra ordem e a lista do canal de voz pulava.
func TestParticipantInfosOrderedByJoinTime(t *testing.T) {
	s := serviceWithCall("call-1")
	base := time.Date(2026, 10, 1, 20, 0, 0, 0, time.UTC)
	joins := map[string]time.Duration{
		"user-c": 3 * time.Minute,
		"user-a": 1 * time.Minute,
		"user-d": 4 * time.Minute,
		"user-b": 2 * time.Minute,
		// Mesmo horário de entrada: desempata pelo id.
		"user-f": 5 * time.Minute,
		"user-e": 5 * time.Minute,
	}
	for id, offset := range joins {
		s.calls["call-1"].participants[id] = &participantState{userID: id, role: RoleMember, joinedAt: base.Add(offset)}
	}

	want := []string{"user-a", "user-b", "user-c", "user-d", "user-e", "user-f"}
	// Várias leituras: a iteração de map do Go muda de ordem a cada uma.
	for round := 0; round < 20; round++ {
		infos := s.participantInfos("call-1")
		if len(infos) != len(want) {
			t.Fatalf("len = %d, want %d", len(infos), len(want))
		}
		for i, p := range infos {
			if p.UserID != want[i] {
				t.Fatalf("round %d: order = %v, want %v", round, ids(infos), want)
			}
		}
	}
}

func ids(infos []ParticipantInfo) []string {
	out := make([]string, len(infos))
	for i, p := range infos {
		out[i] = p.UserID
	}
	return out
}
