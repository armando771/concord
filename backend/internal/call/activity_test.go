package call

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestValidateActivityURL(t *testing.T) {
	cases := []struct {
		name       string
		activityID string
		raw        string
		want       string
		wantErr    error
	}{
		{"sem link", "krunker", "", "", nil},
		{"só espaços", "krunker", "   ", "", nil},
		{"link da sala", "krunker", "https://krunker.io/?game=FRA:abc12", "https://krunker.io/?game=FRA:abc12", nil},
		{"raiz", "krunker", "https://krunker.io", "https://krunker.io", nil},
		{"espaços em volta", "krunker", "  https://krunker.io/?game=NY:x1  ", "https://krunker.io/?game=NY:x1", nil},
		{"http", "krunker", "http://krunker.io/?game=FRA:abc12", "", ErrActivityURL},
		{"outro domínio", "krunker", "https://evil.com/?game=FRA:abc12", "", ErrActivityURL},
		{"subdomínio", "krunker", "https://www.krunker.io/", "", ErrActivityURL},
		{"sufixo enganoso", "krunker", "https://krunker.io.evil.com/", "", ErrActivityURL},
		{"usuário na URL", "krunker", "https://krunker.io@evil.com/", "", ErrActivityURL},
		{"credenciais", "krunker", "https://user:pass@krunker.io/", "", ErrActivityURL},
		{"porta", "krunker", "https://krunker.io:8443/", "", ErrActivityURL},
		{"javascript", "krunker", "javascript:alert(1)", "", ErrActivityURL},
		{"sem esquema", "krunker", "krunker.io/?game=FRA:abc12", "", ErrActivityURL},
		{"longa demais", "krunker", "https://krunker.io/?game=" + strings.Repeat("a", 600), "", ErrActivityURL},
		{"atividade desconhecida", "doom", "https://krunker.io/", "", ErrUnknownActivity},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ValidateActivityURL(tc.activityID, tc.raw)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("err = %v, want %v", err, tc.wantErr)
			}
			if got != tc.want {
				t.Fatalf("url = %q, want %q", got, tc.want)
			}
		})
	}
}

type activityPayload struct {
	CallID     string   `json:"call_id"`
	ActivityID string   `json:"activity_id"`
	URL        string   `json:"url"`
	StartedBy  UserInfo `json:"started_by"`
}

// eventsOfType devolve, por destino, os payloads de um tipo de evento.
func eventsOfType(pub *fakePublisher, typ string) map[string][]json.RawMessage {
	out := map[string][]json.RawMessage{}
	pub.mu.Lock()
	defer pub.mu.Unlock()
	for _, e := range pub.sent {
		var got string
		_ = json.Unmarshal(e.event["type"], &got)
		if got == typ {
			out[e.target] = append(out[e.target], e.event["payload"])
		}
	}
	return out
}

func activityCall(pub *fakePublisher, participants ...string) *Service {
	s := channelCallWith(pub, participants...)
	stubLookupUser(s)
	return s
}

func TestStartActivityGoesOnlyToParticipants(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1", "user-2")

	raw, _ := json.Marshal(ActivityPayload{CallID: "call-1", ActivityID: "krunker", URL: "https://krunker.io/?game=FRA:abc12"})
	s.HandleCallMessage("user-1", "call:activity", raw)

	events := eventsOfType(pub, "call:activity")
	if len(events) != 2 || len(events["user:user-1"]) != 1 || len(events["user:user-2"]) != 1 {
		t.Fatalf("call:activity foi para %v, want só user-1 e user-2", events)
	}
	var p activityPayload
	_ = json.Unmarshal(events["user:user-2"][0], &p)
	want := activityPayload{CallID: "call-1", ActivityID: "krunker", URL: "https://krunker.io/?game=FRA:abc12", StartedBy: UserInfo{ID: "user-1"}}
	if p != want {
		t.Fatalf("payload = %+v, want %+v", p, want)
	}
	for target := range eventsOfType(pub, "call:activity") {
		if strings.HasPrefix(target, "server:") || strings.HasPrefix(target, "call:") {
			t.Fatalf("call:activity vazou para %s", target)
		}
	}
}

func TestStartActivityRejectsNonParticipant(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1")

	raw, _ := json.Marshal(ActivityPayload{CallID: "call-1", ActivityID: "krunker"})
	s.HandleCallMessage("intruso", "call:activity", raw)

	if n := len(eventsOfType(pub, "call:activity")); n != 0 {
		t.Fatalf("intruso conseguiu iniciar atividade (%d eventos)", n)
	}
	if errs := eventsOfType(pub, "call:activity:error"); len(errs["user:intruso"]) != 1 {
		t.Fatalf("intruso devia receber call:activity:error, got %v", errs)
	}
	if got := s.ActivityFor("call-1", "user-1"); got != nil {
		t.Fatalf("atividade ficou salva: %+v", got)
	}
}

func TestStartActivityRejectsForeignURL(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1", "user-2")

	raw, _ := json.Marshal(ActivityPayload{CallID: "call-1", ActivityID: "krunker", URL: "https://evil.com/"})
	s.HandleCallMessage("user-1", "call:activity", raw)

	if n := len(eventsOfType(pub, "call:activity")); n != 0 {
		t.Fatalf("link de fora foi aceito (%d eventos)", n)
	}
	// Erro de atividade não pode ser call:error: o app derruba a chamada com ele.
	if n := len(eventsOfType(pub, "call:error")); n != 0 {
		t.Fatalf("erro de atividade saiu como call:error")
	}
	if errs := eventsOfType(pub, "call:activity:error"); len(errs["user:user-1"]) != 1 {
		t.Fatalf("user-1 devia receber call:activity:error, got %v", errs)
	}
}

func TestActivityForOnlyParticipants(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1", "user-2")
	if err := s.StartActivity(context.Background(), "call-1", "user-1", "krunker", ""); err != nil {
		t.Fatalf("StartActivity: %v", err)
	}

	got := s.ActivityFor("call-1", "user-2")
	if got == nil || got.ActivityID != "krunker" || got.StartedBy.ID != "user-1" || got.URL != "" {
		t.Fatalf("ActivityFor(user-2) = %+v", got)
	}
	if got := s.ActivityFor("call-1", "fora"); got != nil {
		t.Fatalf("quem está fora da chamada viu a atividade: %+v", got)
	}
	if got := s.ActivityFor("call-x", "user-1"); got != nil {
		t.Fatalf("chamada inexistente devolveu atividade: %+v", got)
	}
}

func TestStateFromHandlerCarriesActivityForLateJoiner(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1")
	if err := s.StartActivity(context.Background(), "call-1", "user-1", "krunker", "https://krunker.io/?game=FRA:abc12"); err != nil {
		t.Fatalf("StartActivity: %v", err)
	}
	// Alguém entra depois: o estado da chamada já traz a atividade.
	s.calls["call-1"].participants["user-3"] = &participantState{userID: "user-3", role: RoleMember}

	got := s.ActivityFor("call-1", "user-3")
	if got == nil || got.URL != "https://krunker.io/?game=FRA:abc12" {
		t.Fatalf("quem entrou depois não vê a atividade: %+v", got)
	}
}

func TestStopActivityOnlyByStarter(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1", "user-2")
	if err := s.StartActivity(context.Background(), "call-1", "user-1", "krunker", ""); err != nil {
		t.Fatalf("StartActivity: %v", err)
	}

	if err := s.StopActivity("call-1", "user-2"); !errors.Is(err, ErrActivityOwner) {
		t.Fatalf("StopActivity(user-2) = %v, want ErrActivityOwner", err)
	}
	if s.ActivityFor("call-1", "user-1") == nil {
		t.Fatalf("atividade sumiu com o stop de quem não abriu")
	}

	raw, _ := json.Marshal(LeavePayload{CallID: "call-1"})
	s.HandleCallMessage("user-1", "call:activity:stop", raw)

	if s.ActivityFor("call-1", "user-2") != nil {
		t.Fatalf("atividade continua depois do stop de quem abriu")
	}
	stops := eventsOfType(pub, "call:activity:stop")
	if len(stops["user:user-1"]) != 1 || len(stops["user:user-2"]) != 1 {
		t.Fatalf("call:activity:stop foi para %v", stops)
	}
}

func TestStarterUpdatesLink(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1", "user-2")
	ctx := context.Background()
	if err := s.StartActivity(ctx, "call-1", "user-1", "krunker", ""); err != nil {
		t.Fatalf("StartActivity: %v", err)
	}
	if err := s.StartActivity(ctx, "call-1", "user-1", "krunker", "https://krunker.io/?game=NY:zz9"); err != nil {
		t.Fatalf("StartActivity (link): %v", err)
	}
	if got := s.ActivityFor("call-1", "user-2"); got == nil || got.URL != "https://krunker.io/?game=NY:zz9" {
		t.Fatalf("link não atualizou: %+v", got)
	}
}

func TestStarterLeavingClearsActivity(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1", "user-2", "user-3")
	s.repository = nil
	if err := s.StartActivity(context.Background(), "call-1", "user-1", "krunker", ""); err != nil {
		t.Fatalf("StartActivity: %v", err)
	}

	if _, _, err := s.detachParticipant("call-1", "user-1"); err != nil {
		t.Fatalf("detachParticipant: %v", err)
	}

	if s.ActivityFor("call-1", "user-2") != nil {
		t.Fatalf("atividade continua depois que quem abriu saiu")
	}
	stops := eventsOfType(pub, "call:activity:stop")
	if len(stops["user:user-2"]) != 1 || len(stops["user:user-3"]) != 1 {
		t.Fatalf("call:activity:stop foi para %v, want user-2 e user-3", stops)
	}
	if len(stops["user:user-1"]) != 0 {
		t.Fatalf("quem saiu não devia receber o stop")
	}
}

func TestOtherParticipantLeavingKeepsActivity(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1", "user-2")
	if err := s.StartActivity(context.Background(), "call-1", "user-1", "krunker", ""); err != nil {
		t.Fatalf("StartActivity: %v", err)
	}

	if _, _, err := s.detachParticipant("call-1", "user-2"); err != nil {
		t.Fatalf("detachParticipant: %v", err)
	}

	if s.ActivityFor("call-1", "user-1") == nil {
		t.Fatalf("atividade sumiu quando outro participante saiu")
	}
	if n := len(eventsOfType(pub, "call:activity:stop")); n != 0 {
		t.Fatalf("stop enviado sem motivo (%d)", n)
	}
}

func TestClosingCallClearsActivity(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1")
	if err := s.StartActivity(context.Background(), "call-1", "user-1", "krunker", ""); err != nil {
		t.Fatalf("StartActivity: %v", err)
	}
	if err := s.closeCall("call-1"); err != nil {
		t.Fatalf("closeCall: %v", err)
	}
	if _, ok := s.activities["call-1"]; ok {
		t.Fatalf("atividade ficou na memória depois do fim da chamada")
	}
}

func TestStateEndpointCarriesActivityOnlyForParticipants(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1", "user-2")
	if err := s.StartActivity(context.Background(), "call-1", "user-1", "krunker", "https://krunker.io/?game=FRA:abc12"); err != nil {
		t.Fatalf("StartActivity: %v", err)
	}

	rec := httptest.NewRecorder()
	tokenRouter(s, "user-2").ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/calls/call-1/state", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var body StateResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("json: %v", err)
	}
	if body.Activity == nil || body.Activity.URL != "https://krunker.io/?game=FRA:abc12" || body.Activity.StartedBy.ID != "user-1" {
		t.Fatalf("activity = %+v", body.Activity)
	}

	// A lista do canal de voz (quem está fora também vê) não leva a atividade.
	state, err := s.GetState(context.Background(), "call-1")
	if err != nil {
		t.Fatalf("GetState: %v", err)
	}
	if state.Activity != nil {
		t.Fatalf("GetState vazou a atividade: %+v", state.Activity)
	}

	rec = httptest.NewRecorder()
	tokenRouter(s, "fora").ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/calls/call-1/state", nil))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("quem está fora: status = %d, want 403", rec.Code)
	}
}
