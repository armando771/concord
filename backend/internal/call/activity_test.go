package call

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"
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
	// Os testes de fluxo abrem e encerram em seguida; o cooldown tem teste próprio.
	s.activityCooldown = 0
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
	if !reflect.DeepEqual(p, want) {
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

func TestActivityCooldownPerParticipant(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1", "user-2")
	s.activityCooldown = time.Hour
	ctx := context.Background()

	if err := s.StartActivity(ctx, "call-1", "user-1", "krunker", ""); err != nil {
		t.Fatalf("StartActivity: %v", err)
	}
	// Trocar o link logo depois espera o cooldown.
	if err := s.StartActivity(ctx, "call-1", "user-1", "krunker", "https://krunker.io/?game=NY:zz9"); !errors.Is(err, ErrActivityCooldown) {
		t.Fatalf("troca de link logo depois = %v, want ErrActivityCooldown", err)
	}
	if got := s.ActivityFor("call-1", "user-2"); got == nil || got.URL != "" {
		t.Fatalf("atividade mudou durante o cooldown: %+v", got)
	}
	if n := len(eventsOfType(pub, "call:activity")["user:user-2"]); n != 1 {
		t.Fatalf("user-2 recebeu %d call:activity, want 1", n)
	}

	// Pelo WS, o cooldown vira call:activity:error (nunca call:error).
	raw, _ := json.Marshal(ActivityPayload{CallID: "call-1", ActivityID: "krunker"})
	s.HandleCallMessage("user-1", "call:activity", raw)
	errs := eventsOfType(pub, "call:activity:error")["user:user-1"]
	if len(errs) != 1 || !strings.Contains(string(errs[0]), ErrActivityCooldown.Error()) {
		t.Fatalf("call:activity:error = %s", errs)
	}

	// O cooldown é de cada participante: outra pessoa pode abrir.
	if err := s.StartActivity(ctx, "call-1", "user-2", "krunker", ""); err != nil {
		t.Fatalf("StartActivity(user-2): %v", err)
	}
}

func TestStopActivityIgnoresCooldown(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1", "user-2")
	s.activityCooldown = time.Hour
	ctx := context.Background()

	if err := s.StartActivity(ctx, "call-1", "user-1", "krunker", ""); err != nil {
		t.Fatalf("StartActivity: %v", err)
	}
	// Encerrar logo depois de abrir (fechar a janela, Encerrar) nunca é recusado.
	raw, _ := json.Marshal(LeavePayload{CallID: "call-1"})
	s.HandleCallMessage("user-1", "call:activity:stop", raw)
	if s.ActivityFor("call-1", "user-2") != nil {
		t.Fatalf("stop logo depois de abrir foi recusado pelo cooldown")
	}
	if errs := eventsOfType(pub, "call:activity:error"); len(errs) != 0 {
		t.Fatalf("stop gerou erro: %v", errs)
	}
	if stops := eventsOfType(pub, "call:activity:stop"); len(stops["user:user-2"]) != 1 {
		t.Fatalf("call:activity:stop foi para %v", stops)
	}
	// O stop não reabre a janela do cooldown: abrir de novo continua esperando.
	if err := s.StartActivity(ctx, "call-1", "user-1", "krunker", ""); !errors.Is(err, ErrActivityCooldown) {
		t.Fatalf("reabrir logo depois = %v, want ErrActivityCooldown", err)
	}
}

func TestLeavingRightAfterStartEndsActivity(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1", "user-2")
	s.activityCooldown = time.Hour

	if err := s.StartActivity(context.Background(), "call-1", "user-1", "krunker", ""); err != nil {
		t.Fatalf("StartActivity: %v", err)
	}
	if _, _, err := s.detachParticipant("call-1", "user-1"); err != nil {
		t.Fatalf("detachParticipant: %v", err)
	}
	if s.ActivityFor("call-1", "user-2") != nil {
		t.Fatalf("sair logo depois de abrir não encerrou a atividade")
	}
	if stops := eventsOfType(pub, "call:activity:stop"); len(stops["user:user-2"]) != 1 {
		t.Fatalf("call:activity:stop foi para %v", stops)
	}
}

func TestActivityRejectedAttemptDoesNotStartCooldown(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1")
	s.activityCooldown = time.Hour
	ctx := context.Background()

	if err := s.StartActivity(ctx, "call-1", "user-1", "krunker", "https://evil.com/"); !errors.Is(err, ErrActivityURL) {
		t.Fatalf("link de fora = %v, want ErrActivityURL", err)
	}
	if err := s.StartActivity(ctx, "call-1", "user-1", "krunker", ""); err != nil {
		t.Fatalf("link errado não pode gastar o cooldown: %v", err)
	}
}

// playersOf lê os jogadores do último call:activity:players enviado a target.
func playersOf(t *testing.T, pub *fakePublisher, target string) []string {
	t.Helper()
	events := eventsOfType(pub, "call:activity:players")[target]
	if len(events) == 0 {
		t.Fatalf("%s não recebeu call:activity:players", target)
	}
	var p ActivityPlayersEvent
	if err := json.Unmarshal(events[len(events)-1], &p); err != nil {
		t.Fatalf("json: %v", err)
	}
	return p.Players
}

func TestStarterIsFirstPlayer(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1", "user-2")
	if err := s.StartActivity(context.Background(), "call-1", "user-1", "krunker", ""); err != nil {
		t.Fatalf("StartActivity: %v", err)
	}
	if got := s.ActivityFor("call-1", "user-2"); got == nil || !reflect.DeepEqual(got.Players, []string{"user-1"}) {
		t.Fatalf("players = %+v, want [user-1]", got)
	}
	var p struct {
		Players []string `json:"players"`
	}
	_ = json.Unmarshal(eventsOfType(pub, "call:activity")["user:user-2"][0], &p)
	if !reflect.DeepEqual(p.Players, []string{"user-1"}) {
		t.Fatalf("call:activity sem os jogadores: %+v", p)
	}
}

func TestJoinAndLeaveActivityBroadcastPlayers(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1", "user-2", "user-3")
	if err := s.StartActivity(context.Background(), "call-1", "user-1", "krunker", ""); err != nil {
		t.Fatalf("StartActivity: %v", err)
	}

	raw, _ := json.Marshal(ActivityPresencePayload{CallID: "call-1", ActivityID: "krunker"})
	s.HandleCallMessage("user-2", "call:activity:join", raw)
	for _, target := range []string{"user:user-1", "user:user-2", "user:user-3"} {
		if got := playersOf(t, pub, target); !reflect.DeepEqual(got, []string{"user-1", "user-2"}) {
			t.Fatalf("%s: players = %v", target, got)
		}
	}
	if got := s.ActivityFor("call-1", "user-3"); !reflect.DeepEqual(got.Players, []string{"user-1", "user-2"}) {
		t.Fatalf("estado: players = %v", got.Players)
	}

	// Entrar de novo não repete o aviso.
	before := len(eventsOfType(pub, "call:activity:players")["user:user-3"])
	s.HandleCallMessage("user-2", "call:activity:join", raw)
	if n := len(eventsOfType(pub, "call:activity:players")["user:user-3"]); n != before {
		t.Fatalf("join repetido avisou de novo (%d -> %d)", before, n)
	}

	s.HandleCallMessage("user-2", "call:activity:leave", raw)
	if got := playersOf(t, pub, "user:user-3"); !reflect.DeepEqual(got, []string{"user-1"}) {
		t.Fatalf("depois do leave: players = %v", got)
	}
}

func TestJoinActivityRejectsOutsiders(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1")
	if err := s.StartActivity(context.Background(), "call-1", "user-1", "krunker", ""); err != nil {
		t.Fatalf("StartActivity: %v", err)
	}
	raw, _ := json.Marshal(ActivityPresencePayload{CallID: "call-1", ActivityID: "krunker"})
	s.HandleCallMessage("intruso", "call:activity:join", raw)
	if got := s.ActivityFor("call-1", "user-1"); !reflect.DeepEqual(got.Players, []string{"user-1"}) {
		t.Fatalf("intruso entrou na atividade: %v", got.Players)
	}
	if n := len(eventsOfType(pub, "call:activity:players")); n != 0 {
		t.Fatalf("join de quem está fora avisou a chamada (%d)", n)
	}
	if errs := eventsOfType(pub, "call:activity:error"); len(errs["user:intruso"]) != 1 {
		t.Fatalf("intruso devia receber call:activity:error, got %v", errs)
	}
}

func TestJoinWithoutActivityOrOtherActivityIsIgnored(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1", "user-2")
	raw, _ := json.Marshal(ActivityPresencePayload{CallID: "call-1", ActivityID: "krunker"})
	// Sem atividade aberta (corrida com o stop): nada acontece, nem erro.
	s.HandleCallMessage("user-2", "call:activity:join", raw)
	if n := len(eventsOfType(pub, "call:activity:error")) + len(eventsOfType(pub, "call:activity:players")); n != 0 {
		t.Fatalf("join sem atividade gerou %d eventos", n)
	}

	if err := s.StartActivity(context.Background(), "call-1", "user-1", "krunker", ""); err != nil {
		t.Fatalf("StartActivity: %v", err)
	}
	// Join de outra atividade (já trocada ou encerrada) não conta.
	other, _ := json.Marshal(ActivityPresencePayload{CallID: "call-1", ActivityID: "doom"})
	s.HandleCallMessage("user-2", "call:activity:join", other)
	if got := s.ActivityFor("call-1", "user-2"); !reflect.DeepEqual(got.Players, []string{"user-1"}) {
		t.Fatalf("join da atividade antiga contou: %v", got.Players)
	}
}

func TestStarterLeaveMessageKeepsStarter(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1", "user-2")
	if err := s.StartActivity(context.Background(), "call-1", "user-1", "krunker", ""); err != nil {
		t.Fatalf("StartActivity: %v", err)
	}
	raw, _ := json.Marshal(ActivityPresencePayload{CallID: "call-1", ActivityID: "krunker"})
	s.HandleCallMessage("user-1", "call:activity:leave", raw)
	if got := s.ActivityFor("call-1", "user-2"); got == nil || !reflect.DeepEqual(got.Players, []string{"user-1"}) {
		t.Fatalf("quem abriu saiu da lista sem encerrar: %+v", got)
	}
}

func TestLinkUpdateKeepsPlayersNewActivityResets(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1", "user-2", "user-3")
	ctx := context.Background()
	if err := s.StartActivity(ctx, "call-1", "user-1", "krunker", ""); err != nil {
		t.Fatalf("StartActivity: %v", err)
	}
	if err := s.JoinActivity("call-1", "user-2", "krunker"); err != nil {
		t.Fatalf("JoinActivity: %v", err)
	}
	// A sala capturada (troca de link) mantém quem já estava jogando.
	if err := s.StartActivity(ctx, "call-1", "user-1", "krunker", "https://krunker.io/?game=BRZ:tukbo"); err != nil {
		t.Fatalf("StartActivity (link): %v", err)
	}
	if got := s.ActivityFor("call-1", "user-3"); !reflect.DeepEqual(got.Players, []string{"user-1", "user-2"}) {
		t.Fatalf("troca de link perdeu jogadores: %v", got.Players)
	}
	// Outra pessoa abre a atividade: começa só com ela.
	if err := s.StartActivity(ctx, "call-1", "user-3", "krunker", ""); err != nil {
		t.Fatalf("StartActivity (outra): %v", err)
	}
	if got := s.ActivityFor("call-1", "user-1"); !reflect.DeepEqual(got.Players, []string{"user-3"}) {
		t.Fatalf("atividade nova herdou jogadores: %v", got.Players)
	}
}

func TestPlayerLeavingCallLeavesActivity(t *testing.T) {
	pub := &fakePublisher{}
	s := activityCall(pub, "user-1", "user-2", "user-3")
	if err := s.StartActivity(context.Background(), "call-1", "user-1", "krunker", ""); err != nil {
		t.Fatalf("StartActivity: %v", err)
	}
	if err := s.JoinActivity("call-1", "user-2", "krunker"); err != nil {
		t.Fatalf("JoinActivity: %v", err)
	}
	if _, _, err := s.detachParticipant("call-1", "user-2"); err != nil {
		t.Fatalf("detachParticipant: %v", err)
	}
	if got := playersOf(t, pub, "user:user-3"); !reflect.DeepEqual(got, []string{"user-1"}) {
		t.Fatalf("quem saiu da chamada continua jogando: %v", got)
	}
	// Quem saiu da chamada sem estar na atividade não gera aviso.
	before := len(eventsOfType(pub, "call:activity:players")["user:user-1"])
	if _, _, err := s.detachParticipant("call-1", "user-3"); err != nil {
		t.Fatalf("detachParticipant: %v", err)
	}
	if n := len(eventsOfType(pub, "call:activity:players")["user:user-1"]); n != before {
		t.Fatalf("saída de quem não jogava avisou (%d -> %d)", before, n)
	}
}
