package call

import (
	"context"
	"errors"
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

// fakeRestoreStore simula o banco na subida, com falhas sob medida.
type fakeRestoreStore struct {
	calls        []*Call
	participants map[string][]CallParticipant
	failUnended  bool
	failFor      string
	ended        []string
}

func (f *fakeRestoreStore) ListUnended(context.Context) ([]*Call, error) {
	if f.failUnended {
		return nil, errors.New("conexão recusada")
	}
	return f.calls, nil
}

func (f *fakeRestoreStore) ListParticipants(_ context.Context, callID string) ([]CallParticipant, error) {
	if callID == f.failFor {
		return nil, errors.New("tempo esgotado")
	}
	return f.participants[callID], nil
}

func (f *fakeRestoreStore) EndCall(_ context.Context, id string) error {
	f.ended = append(f.ended, id)
	return nil
}

func TestRestoreActiveFailsWithoutTouchingCallsWhenParticipantsCannotBeRead(t *testing.T) {
	s := CallService(nil, nil, nil, nil, nil, nil, nil)
	store := &fakeRestoreStore{
		calls: []*Call{
			{ID: "a", Type: TypeChannel, Status: StatusActive},
			{ID: "b", Type: TypeChannel, Status: StatusActive},
		},
		participants: map[string][]CallParticipant{"a": {{CallID: "a", UserID: "ana"}}},
		failFor:      "b",
	}
	s.restoreStore = store

	if err := s.RestoreActive(context.Background()); err == nil {
		t.Fatal("RestoreActive = nil com a leitura dos participantes falhando")
	}
	// Erro passageiro não pode encerrar chamada no banco nem meia-restaurar.
	if len(store.ended) != 0 {
		t.Fatalf("encerrou %v por causa de um erro de leitura", store.ended)
	}
	if s.IsParticipant("a", "ana") {
		t.Fatal("restaurou pela metade")
	}

	// Na tentativa seguinte o banco responde: tudo volta.
	store.failFor = ""
	store.participants["b"] = []CallParticipant{{CallID: "b", UserID: "bia"}}
	if err := s.RestoreActive(context.Background()); err != nil {
		t.Fatalf("RestoreActive: %v", err)
	}
	if !s.IsParticipant("a", "ana") || !s.IsParticipant("b", "bia") {
		t.Fatal("chamadas não voltaram na nova tentativa")
	}
}

func TestRestoreActiveFailsWhenCallsCannotBeListed(t *testing.T) {
	s := CallService(nil, nil, nil, nil, nil, nil, nil)
	s.restoreStore = &fakeRestoreStore{failUnended: true}
	if err := s.RestoreActive(context.Background()); err == nil {
		t.Fatal("RestoreActive = nil sem conseguir listar as chamadas")
	}
}

// DM atendida antes desta correção ficava "ringing" no banco: com os dois
// participantes dentro, ela estava em andamento e tem que voltar.
func TestRestoreKeepsAnsweredDMStillMarkedRinging(t *testing.T) {
	s := CallService(nil, nil, nil, nil, nil, nil, nil)
	conv := "conversa-1"
	left := time.Now()

	toEnd := s.restore(
		[]*Call{
			{ID: "dm-atendida", Type: TypeDM, Status: StatusRinging, ConversationID: &conv},
			{ID: "dm-tocando", Type: TypeDM, Status: StatusRinging},
			{ID: "dm-um-saiu", Type: TypeDM, Status: StatusRinging},
		},
		map[string][]CallParticipant{
			"dm-atendida": {{CallID: "dm-atendida", UserID: "ana"}, {CallID: "dm-atendida", UserID: "bia"}},
			"dm-tocando":  {{CallID: "dm-tocando", UserID: "caio"}},
			"dm-um-saiu":  {{CallID: "dm-um-saiu", UserID: "dani"}, {CallID: "dm-um-saiu", UserID: "edu", LeftAt: &left}},
		},
	)

	if !s.IsParticipant("dm-atendida", "ana") || !s.IsParticipant("dm-atendida", "bia") {
		t.Fatal("DM atendida não voltou depois do reinício")
	}
	if c, err := s.FindActiveByScope(TypeDM, conv); err != nil || c.Status != StatusActive {
		t.Fatalf("DM restaurada = %+v, %v; want ativa", c, err)
	}
	sort.Strings(toEnd)
	if len(toEnd) != 2 || toEnd[0] != "dm-tocando" || toEnd[1] != "dm-um-saiu" {
		t.Fatalf("toEnd = %v, want [dm-tocando dm-um-saiu]", toEnd)
	}
}
