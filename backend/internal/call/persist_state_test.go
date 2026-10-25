package call

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
)

// fakeStateStore registra o que seria gravado no banco.
type fakeStateStore struct {
	mu     sync.Mutex
	voice  []string
	screen []string
	active []string
	// Se não for nil, MarkCallActive também anota aqui (ordem das gravações).
	order *[]string
}

func (f *fakeStateStore) SaveVoiceState(_ context.Context, callID, userID string, muted, deafened bool) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.voice = append(f.voice, callID+"/"+userID+"/"+boolStr(muted)+"/"+boolStr(deafened))
	return nil
}

func (f *fakeStateStore) SaveScreenSharing(_ context.Context, callID, userID string, active bool) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.screen = append(f.screen, callID+"/"+userID+"/"+boolStr(active))
	return nil
}

func boolStr(b bool) string {
	if b {
		return "sim"
	}
	return "nao"
}

func eventTypes(pub *fakePublisher) []string {
	var out []string
	for _, e := range pub.sent {
		var typ string
		_ = json.Unmarshal(e.event["type"], &typ)
		out = append(out, typ)
	}
	return out
}

func TestRestoreKeepsVoiceAndScreenStateAcrossRestart(t *testing.T) {
	s := CallService(nil, nil, nil, nil, nil, nil, nil)
	channelID, serverID := "canal-1", "server-1"

	s.restore(
		[]*Call{{ID: "ativa", Type: TypeChannel, Status: StatusActive, ChannelID: &channelID, ServerID: &serverID}},
		map[string][]CallParticipant{
			"ativa": {
				{CallID: "ativa", UserID: "ana", Role: RoleMember, Muted: true},
				{CallID: "ativa", UserID: "bia", Role: RoleMember, Muted: true, Deafened: true},
				{CallID: "ativa", UserID: "caio", Role: RoleMember, ScreenSharing: true},
			},
		},
	)

	// O ícone de mudo não pisca: o estado volta junto com a chamada.
	got := map[string][2]bool{}
	for _, p := range s.participantInfos("ativa") {
		got[p.UserID] = [2]bool{p.Muted, p.Deafened}
	}
	want := map[string][2]bool{"ana": {true, false}, "bia": {true, true}, "caio": {false, false}}
	for id, w := range want {
		if got[id] != w {
			t.Fatalf("%s: muted/deafened = %v, want %v", id, got[id], w)
		}
	}
	// O selo LIVE também: quem transmitia continua transmitindo.
	if _, ok := s.screenSharers["ativa"]["caio"]; !ok || len(s.screenSharers["ativa"]) != 1 {
		t.Fatalf("screenSharers = %v, want só caio", s.screenSharers["ativa"])
	}
}

func TestSetVoiceStateIsSaved(t *testing.T) {
	s := channelCallWith(&fakePublisher{}, "user-1")
	store := &fakeStateStore{}
	s.stateStore = store

	_ = s.SetVoiceState("call-1", "user-1", true, false)

	if len(store.voice) != 1 || store.voice[0] != "call-1/user-1/sim/nao" {
		t.Fatalf("gravado = %v", store.voice)
	}
}

func TestSetVoiceStateUnchangedIsSilent(t *testing.T) {
	pub := &fakePublisher{}
	s := channelCallWith(pub, "user-1")
	store := &fakeStateStore{}
	s.stateStore = store
	_ = s.SetVoiceState("call-1", "user-1", true, false)
	pub.sent = nil

	// O app reenvia o estado ao reconectar: se nada mudou, ninguém é avisado.
	if err := s.SetVoiceState("call-1", "user-1", true, false); err != nil {
		t.Fatalf("SetVoiceState: %v", err)
	}
	if len(pub.sent) != 0 {
		t.Fatalf("eventos = %v, want nenhum", eventTypes(pub))
	}
	if len(store.voice) != 1 {
		t.Fatalf("gravou de novo sem mudança: %v", store.voice)
	}
}

func TestSetScreenShareIsSaved(t *testing.T) {
	s := channelCallWith(&fakePublisher{}, "user-1", "user-2")
	stubLookupUser(s)
	store := &fakeStateStore{}
	s.stateStore = store

	_ = s.SetScreenShare(context.Background(), "call-1", "user-1", true)
	_ = s.SetScreenShare(context.Background(), "call-1", "user-1", false)

	if len(store.screen) != 2 || store.screen[0] != "call-1/user-1/sim" || store.screen[1] != "call-1/user-1/nao" {
		t.Fatalf("gravado = %v", store.screen)
	}
}

func TestSetScreenShareUnchangedIsSilent(t *testing.T) {
	pub := &fakePublisher{}
	s := channelCallWith(pub, "user-1", "user-2")
	stubLookupUser(s)
	store := &fakeStateStore{}
	s.stateStore = store

	// Reconectou sem estar transmitindo: nada de call:live/call:screen.
	if err := s.SetScreenShare(context.Background(), "call-1", "user-1", false); err != nil {
		t.Fatalf("SetScreenShare: %v", err)
	}
	_ = s.SetScreenShare(context.Background(), "call-1", "user-2", true)
	pub.sent = nil
	// Quem transmite reanuncia ao reconectar: o selo não pisca.
	if err := s.SetScreenShare(context.Background(), "call-1", "user-2", true); err != nil {
		t.Fatalf("SetScreenShare: %v", err)
	}

	if len(pub.sent) != 0 {
		t.Fatalf("eventos = %v, want nenhum", eventTypes(pub))
	}
	if len(store.screen) != 1 {
		t.Fatalf("gravado = %v, want só o início da transmissão", store.screen)
	}
}

func (f *fakeStateStore) MarkCallActive(_ context.Context, callID string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.active = append(f.active, callID)
	if f.order != nil {
		*f.order = append(*f.order, "ativa "+callID)
	}
	return nil
}

// Atender a DM tem que ir para o banco: senão ela continua "ringing" e o
// próximo reinício a encerra.
func TestAcceptPersistsCallAsActive(t *testing.T) {
	s := serviceWithCall("dm-1", "ana")
	s.calls["dm-1"].info.Type = TypeDM
	s.calls["dm-1"].info.Status = StatusRinging
	s.calls["dm-1"].inviteeID = "bia"
	s.publisher = &fakePublisher{}
	s.lookupUser = func(_ context.Context, id string) (UserInfo, error) { return UserInfo{ID: id}, nil }
	// Ordem das gravações: quem entrou antes do status ativo (se o backend
	// cair entre os dois, a subida cura a DM com os dois dentro).
	var order []string
	store := &fakeStateStore{order: &order}
	s.stateStore = store
	s.addParticipant = func(_ context.Context, p *CallParticipant) error {
		store.mu.Lock()
		defer store.mu.Unlock()
		order = append(order, "participante "+p.UserID)
		return nil
	}

	if err := s.Accept(context.Background(), "dm-1", "bia"); err != nil {
		t.Fatalf("Accept: %v", err)
	}

	if len(order) != 2 || order[0] != "participante bia" || order[1] != "ativa dm-1" {
		t.Fatalf("gravações = %v, want [participante bia, ativa dm-1]", order)
	}
}
