package call

import (
	"sort"
	"testing"
	"time"
)

func TestRestoreRebuildsActiveCallsAfterRestart(t *testing.T) {
	s := CallService(nil, nil, nil, nil, nil, nil, nil)
	left := time.Now()
	channelID, serverID := "canal-1", "server-1"

	toEnd := s.restore(
		[]*Call{
			{ID: "ativa", Type: TypeChannel, Status: StatusActive, ChannelID: &channelID, ServerID: &serverID},
			{ID: "tocando", Type: TypeDM, Status: StatusRinging},
			{ID: "vazia", Type: TypeChannel, Status: StatusActive},
		},
		map[string][]CallParticipant{
			"ativa": {
				{CallID: "ativa", UserID: "ana", Role: RoleMember},
				{CallID: "ativa", UserID: "bia", Role: RoleMember},
				{CallID: "ativa", UserID: "caio", Role: RoleMember, LeftAt: &left},
			},
			"tocando": {{CallID: "tocando", UserID: "ana", Role: RoleMember}},
			"vazia":   {{CallID: "vazia", UserID: "dani", Role: RoleMember, LeftAt: &left}},
		},
	)

	// quem estava na chamada continua participante; quem já saiu, não
	if !s.IsParticipant("ativa", "ana") || !s.IsParticipant("ativa", "bia") {
		t.Fatal("participants of the active call were not restored")
	}
	if s.IsParticipant("ativa", "caio") {
		t.Fatal("a participant who had left came back")
	}
	if !s.IsBusy("ana") || s.IsBusy("caio") {
		t.Fatal("busy state not restored correctly")
	}
	if call, err := s.FindActiveByScope(TypeChannel, channelID); err != nil || call.ID != "ativa" {
		t.Fatalf("active channel call not found by scope: %v %v", call, err)
	}

	// chamada que só tocava e chamada sem ninguém são encerradas
	sort.Strings(toEnd)
	if len(toEnd) != 2 || toEnd[0] != "tocando" || toEnd[1] != "vazia" {
		t.Fatalf("toEnd = %v, want [tocando vazia]", toEnd)
	}
	if s.IsParticipant("tocando", "ana") {
		t.Fatal("ringing call should not be restored")
	}
}
