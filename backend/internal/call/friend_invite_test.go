package call

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"gin-quickstart/backend/internal/channel"
	"gin-quickstart/backend/internal/permission"
	"gin-quickstart/backend/internal/server"
)

type fakeFriends map[string]bool

func (f fakeFriends) AreFriends(_ context.Context, a, b string) (bool, error) {
	return f[a+":"+b] || f[b+":"+a], nil
}

// fakeAccess: quem não está na lista não enxerga/conecta no canal.
type fakeAccess map[string]bool

func (f fakeAccess) Snapshot(context.Context, string) (*permission.Snapshot, error) {
	return nil, errors.New("não usado")
}

func (f fakeAccess) ChannelPerms(_ context.Context, _ string, userID string) (int64, error) {
	if f[userID] {
		return permission.ViewChannel | permission.Connect, nil
	}
	return 0, nil
}

// fakePoster guarda os cartões "postados" na DM.
type fakePoster struct {
	posts []postedInvite
	err   error
}

type postedInvite struct {
	inviter, invitee string
	card             InviteCard
}

func (f *fakePoster) PostCallInvite(_ context.Context, inviterID, inviteeID string, card InviteCard) error {
	if f.err != nil {
		return f.err
	}
	f.posts = append(f.posts, postedInvite{inviterID, inviteeID, card})
	return nil
}

func (f *fakePoster) postedTo(id string) int {
	n := 0
	for _, p := range f.posts {
		if p.invitee == id {
			n++
		}
	}
	return n
}

// inviteService: ana está na chamada; bia, caio e davi são amigos dela e
// podem entrar; eli não é amiga.
func inviteService(pub *fakePublisher) (*Service, *fakePoster) {
	s := lockedCallWith(pub, "ana")
	s.invite.friends = fakeFriends{"ana:bia": true, "ana:caio": true, "ana:davi": true, "ana:fred": true}
	s.perms = fakeAccess{"bia": true, "caio": true, "davi": true, "eli": true}
	poster := &fakePoster{}
	s.invite.poster = poster
	return s, poster
}

func statusOf(results []InviteResult, id string) string {
	for _, r := range results {
		if r.UserID == id {
			return r.Status
		}
	}
	return ""
}

func TestInviteOnlyFriends(t *testing.T) {
	s, poster := inviteService(&fakePublisher{})

	res, err := s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia", "eli", "fred"})
	if err != nil {
		t.Fatalf("InviteFriends: %v", err)
	}
	if got := statusOf(res, "bia"); got != InviteSent {
		t.Fatalf("bia = %q", got)
	}
	if got := statusOf(res, "eli"); got != InviteNotFriend {
		t.Fatalf("eli (não amiga) = %q", got)
	}
	// fred é amigo mas sem acesso ao canal: o servidor valida a permissão.
	if got := statusOf(res, "fred"); got != InviteNoAccess {
		t.Fatalf("fred (sem acesso) = %q", got)
	}
	if len(poster.posts) != 1 || poster.postedTo("bia") != 1 {
		t.Fatalf("posts = %+v, want só o da bia", poster.posts)
	}
}

func TestInviteManyInOneAction(t *testing.T) {
	s, poster := inviteService(&fakePublisher{})

	res, err := s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia", "caio", "davi", "bia"})
	if err != nil || len(res) != 3 {
		t.Fatalf("res = %+v, err = %v", res, err)
	}
	if len(poster.posts) != 3 {
		t.Fatalf("posts = %d, want 3", len(poster.posts))
	}
}

func TestInviteCardIdentifiesCallChannelAndPlace(t *testing.T) {
	s, poster := inviteService(&fakePublisher{})
	s.SetPlaceSources(fakeChannels{}, fakeServers{})
	if _, err := s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"}); err != nil {
		t.Fatal(err)
	}
	if len(poster.posts) != 1 {
		t.Fatalf("posts = %+v", poster.posts)
	}
	p := poster.posts[0]
	if p.inviter != "ana" || p.invitee != "bia" || p.card.CallID != "call-1" || p.card.ChannelID != "geral" ||
		p.card.ServerID == nil || p.card.ChannelName != "Geral" || p.card.ServerName != "Salinha" {
		t.Fatalf("post = %+v", p)
	}
}

func TestInviteRejectsDuplicateWithinResendWindow(t *testing.T) {
	s, poster := inviteService(&fakePublisher{})
	_, _ = s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})

	res, _ := s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	if got := statusOf(res, "bia"); got != InviteAlreadyInvited {
		t.Fatalf("segundo convite = %q", got)
	}
	if len(poster.posts) != 1 {
		t.Fatalf("posts = %d, want 1", len(poster.posts))
	}
}

func TestInviteAllowsResendAfterWindow(t *testing.T) {
	s, poster := inviteService(&fakePublisher{})
	_, _ = s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	// O convite não "expira" na DM, mas o anti-spam só segura por um tempo.
	inv := s.calls["call-1"].invites.sent["bia"]
	inv.at = time.Now().Add(-inviteResendAfter - time.Second)
	s.calls["call-1"].invites.sent["bia"] = inv

	res, _ := s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	if got := statusOf(res, "bia"); got != InviteSent || len(poster.posts) != 2 {
		t.Fatalf("depois da janela = %q, posts = %d", got, len(poster.posts))
	}
}

func TestInviteFailedPostReleasesReservation(t *testing.T) {
	s, poster := inviteService(&fakePublisher{})
	poster.err = errors.New("dm bloqueada")

	res, _ := s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	if got := statusOf(res, "bia"); got != InviteFailed {
		t.Fatalf("bia = %q, want failed", got)
	}
	// A falha não prende a pessoa: dá para tentar de novo.
	poster.err = nil
	res, _ = s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	if got := statusOf(res, "bia"); got != InviteSent {
		t.Fatalf("retentativa = %q", got)
	}
}

func TestInviteFailedResendRestoresPreviousReservation(t *testing.T) {
	s, poster := inviteService(&fakePublisher{})
	_, _ = s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	old := time.Now().Add(-inviteResendAfter - time.Second)
	s.calls["call-1"].invites.sent["bia"] = invitation{inviterID: "ana", at: old}

	poster.err = errors.New("falhou")
	_, _ = s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	if got := s.calls["call-1"].invites.sent["bia"]; !got.at.Equal(old) {
		t.Fatalf("a falha deveria devolver o registro antigo, got %+v", got)
	}
}

func TestInviteWithoutPosterFails(t *testing.T) {
	s, _ := inviteService(&fakePublisher{})
	s.invite.poster = nil
	res, _ := s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	if got := statusOf(res, "bia"); got != InviteFailed {
		t.Fatalf("bia = %q", got)
	}
}

func TestInviteRejectsPeopleAlreadyInCall(t *testing.T) {
	s, _ := inviteService(&fakePublisher{})
	s.calls["call-1"].participants["bia"] = &participantState{userID: "bia"}

	res, _ := s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	if got := statusOf(res, "bia"); got != InviteAlreadyInCall {
		t.Fatalf("bia = %q", got)
	}
}

func TestInviteRejectsBusyAndBlockedButNotOffline(t *testing.T) {
	s, _ := inviteService(&fakePublisher{})
	// Offline não impede: o convite fica salvo na DM.
	s.isOnline = func(id string) bool { return id != "caio" }
	s.busy["davi"] = "outra-call"
	s.blockedCheck = func(_ context.Context, _, b string) (bool, error) { return b == "bia", nil }

	res, _ := s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia", "caio", "davi"})
	if statusOf(res, "bia") != InviteBlocked || statusOf(res, "caio") != InviteSent || statusOf(res, "davi") != InviteBusy {
		t.Fatalf("res = %+v", res)
	}
}

func TestInviteRequiresParticipantAndChannelCall(t *testing.T) {
	s, _ := inviteService(&fakePublisher{})
	if _, err := s.InviteFriends(context.Background(), "call-1", "bia", []string{"caio"}); !errors.Is(err, ErrInviteNotAllowed) {
		t.Fatalf("não participante: err = %v", err)
	}
	if _, err := s.InviteFriends(context.Background(), "nao-existe", "ana", []string{"bia"}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("call inexistente: err = %v", err)
	}
	s.calls["call-1"].info.Type = TypeDM
	if _, err := s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"}); !errors.Is(err, ErrNotChannelCall) {
		t.Fatalf("DM: err = %v", err)
	}
}

func TestInviteLimitsRequestSize(t *testing.T) {
	s, _ := inviteService(&fakePublisher{})
	if _, err := s.InviteFriends(context.Background(), "call-1", "ana", nil); !errors.Is(err, ErrNoInvitees) {
		t.Fatalf("vazio: err = %v", err)
	}
	many := make([]string, 0, maxInviteesPerRequest+1)
	for i := 0; i <= maxInviteesPerRequest; i++ {
		many = append(many, string(rune('a'+i))+"-user")
	}
	if _, err := s.InviteFriends(context.Background(), "call-1", "ana", many); !errors.Is(err, ErrTooManyInvitees) {
		t.Fatalf("muitos: err = %v", err)
	}
}

func TestOpenInviteAdmitsInvitedPersonInLockedRoom(t *testing.T) {
	s, _ := inviteService(&fakePublisher{})
	s.calls["call-1"].info.Locked = true
	_, _ = s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})

	admitted, err := s.OpenFriendInvite("call-1", "bia")
	if err != nil || !admitted {
		t.Fatalf("Open: admitted=%v err=%v", admitted, err)
	}
	s.mu.Lock()
	ok := canEnterLockedLocked(s.calls["call-1"], "bia", time.Now())
	s.mu.Unlock()
	if !ok {
		t.Fatal("abrir o convite deveria dar o passe de entrada")
	}
	// Quem não foi convidado não ganha passe: o convite não vale para ele.
	admitted, err = s.OpenFriendInvite("call-1", "caio")
	if !errors.Is(err, ErrInviteInvalid) || admitted {
		t.Fatalf("sem convite: admitted=%v err=%v", admitted, err)
	}
}

func TestOpenInviteOfEndedCallIsNotFound(t *testing.T) {
	s, _ := inviteService(&fakePublisher{})
	if _, err := s.OpenFriendInvite("nao-existe", "bia"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v", err)
	}
}

func TestInviteValidFollowsCallState(t *testing.T) {
	s, _ := inviteService(&fakePublisher{})
	_, _ = s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	if !s.InviteValid("call-1", "bia", false) {
		t.Fatal("call ativa com convite deveria ser válida para o convidado")
	}
	if s.InviteValid("nao-existe", "bia", false) {
		t.Fatal("call que não existe é inválida")
	}
	if err := s.closeCall("call-1"); err != nil {
		t.Fatal(err)
	}
	if s.InviteValid("call-1", "bia", false) {
		t.Fatal("call encerrada é inválida")
	}
}

func TestClosingCallNotifiesInviterAndInviteesOnce(t *testing.T) {
	pub := &fakePublisher{}
	s, _ := inviteService(pub)
	_, _ = s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia", "caio"})

	if err := s.closeCall("call-1"); err != nil {
		t.Fatal(err)
	}
	got := map[string]int{}
	for _, e := range pub.eventsOf("call:invite_ended") {
		var p InviteEndedEvent
		_ = json.Unmarshal(e.event["payload"], &p)
		if p.CallID != "call-1" {
			t.Fatalf("payload = %+v", p)
		}
		got[e.target]++
	}
	if len(got) != 3 || got["user:ana"] != 1 || got["user:bia"] != 1 || got["user:caio"] != 1 {
		t.Fatalf("avisos = %+v", got)
	}
}

func TestClosingCallWithoutInvitesSendsNothing(t *testing.T) {
	pub := &fakePublisher{}
	s, _ := inviteService(pub)
	if err := s.closeCall("call-1"); err != nil {
		t.Fatal(err)
	}
	if n := len(pub.eventsOf("call:invite_ended")); n != 0 {
		t.Fatalf("avisos = %d, want 0", n)
	}
}

func inviteRouter(s *Service, userID string) http.Handler {
	return tokenRouter(s, userID)
}

func TestInviteHandlerStatusCodes(t *testing.T) {
	s, _ := inviteService(&fakePublisher{})
	cases := []struct {
		name, method, user, path, body string
		want                           int
	}{
		{"ok", "POST", "ana", "/api/calls/call-1/invites", `{"user_ids":["bia"]}`, http.StatusOK},
		{"payload inválido", "POST", "ana", "/api/calls/call-1/invites", `{`, http.StatusBadRequest},
		{"sem ninguém", "POST", "ana", "/api/calls/call-1/invites", `{"user_ids":[]}`, http.StatusBadRequest},
		{"não participante", "POST", "bia", "/api/calls/call-1/invites", `{"user_ids":["caio"]}`, http.StatusForbidden},
		{"call inexistente", "POST", "ana", "/api/calls/x/invites", `{"user_ids":["bia"]}`, http.StatusNotFound},
		{"abrir sem convite", "POST", "caio", "/api/calls/call-1/invites/open", ``, http.StatusNotFound},
		{"abrir", "POST", "bia", "/api/calls/call-1/invites/open", ``, http.StatusOK},
		{"abrir call acabada", "POST", "bia", "/api/calls/x/invites/open", ``, http.StatusNotFound},
		{"validade", "GET", "bia", "/api/calls/call-1/invite", ``, http.StatusOK},
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(c.method, c.path, bytes.NewBufferString(c.body))
		inviteRouter(s, c.user).ServeHTTP(rec, req)
		if rec.Code != c.want {
			t.Errorf("%s: status = %d, want %d (%s)", c.name, rec.Code, c.want, rec.Body.String())
		}
	}
}

func TestInviteStatusHandlerBody(t *testing.T) {
	s, _ := inviteService(&fakePublisher{})
	_, _ = s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	for path, want := range map[string]string{
		"/api/calls/call-1/invite": `{"valid":true}`,
		"/api/calls/x/invite":      `{"valid":false}`,
	} {
		rec := httptest.NewRecorder()
		inviteRouter(s, "bia").ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if strings.TrimSpace(rec.Body.String()) != want {
			t.Errorf("%s: body = %s, want %s", path, rec.Body.String(), want)
		}
	}
}

type fakeChannels struct{}

func (fakeChannels) FindByID(_ context.Context, id string) (*channel.Channel, error) {
	if id == "geral" {
		return &channel.Channel{Name: "Geral"}, nil
	}
	return nil, errors.New("não achou")
}

type fakeServers struct{}

func (fakeServers) FindByID(context.Context, string) (*server.Server, error) {
	return &server.Server{Name: "Salinha"}, nil
}

func TestPlaceNamesFallsBackToEmpty(t *testing.T) {
	s, _ := inviteService(&fakePublisher{})
	s.SetPlaceSources(fakeChannels{}, fakeServers{})
	srv := "server-1"
	if ch, sv := s.placeNames(context.Background(), "outro", &srv); ch != "" || sv != "Salinha" {
		t.Fatalf("ch=%q sv=%q", ch, sv)
	}
	bare, _ := inviteService(&fakePublisher{})
	if ch, sv := bare.placeNames(context.Background(), "geral", nil); ch != "" || sv != "" {
		t.Fatalf("sem fontes: ch=%q sv=%q", ch, sv)
	}
}

// Convite de uso único: entrar na call gasta o convite do convidado.

func TestJoiningConsumesInviteAndTellsInvitee(t *testing.T) {
	pub := &fakePublisher{}
	s, _ := inviteService(pub)
	_, _ = s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	if _, err := s.OpenFriendInvite("call-1", "bia"); err != nil {
		t.Fatalf("Open: %v", err)
	}
	if !s.InviteValid("call-1", "bia", false) {
		t.Fatal("antes de entrar o convite vale")
	}
	if err := s.joinForTest("call-1", "bia"); err != nil {
		t.Fatalf("Join: %v", err)
	}
	if s.InviteValid("call-1", "bia", false) {
		t.Fatal("depois de entrar o convite não vale mais")
	}
	evs := pub.eventsOf("call:invite_ended")
	if len(evs) != 1 || evs[0].target != "user:bia" {
		t.Fatalf("avisos = %+v, want só para bia", evs)
	}
	var p InviteEndedEvent
	_ = json.Unmarshal(evs[0].event["payload"], &p)
	if p.CallID != "call-1" || p.Role != InviteRoleInvitee {
		t.Fatalf("payload = %+v", p)
	}
}

func TestUsedInviteCannotBeOpenedAgainEvenAfterLeaving(t *testing.T) {
	pub := &fakePublisher{}
	s, _ := inviteService(pub)
	s.calls["call-1"].info.Locked = true
	_, _ = s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	_, _ = s.OpenFriendInvite("call-1", "bia")
	if err := s.joinForTest("call-1", "bia"); err != nil {
		t.Fatalf("Join: %v", err)
	}
	if _, err := s.detachForTest("call-1", "bia"); err != nil {
		t.Fatal(err)
	}
	admitted, err := s.OpenFriendInvite("call-1", "bia")
	if !errors.Is(err, ErrInviteInvalid) || admitted {
		t.Fatalf("cartão antigo reabriu: admitted=%v err=%v", admitted, err)
	}
	s.mu.Lock()
	ok := canEnterLockedLocked(s.calls["call-1"], "bia", time.Now())
	s.mu.Unlock()
	if ok {
		t.Fatal("o passe não pode sobrar do convite usado")
	}
}

func TestInviteIsInvalidForInviteeAlreadyInCall(t *testing.T) {
	s, _ := inviteService(&fakePublisher{})
	_, _ = s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	s.mu.Lock()
	s.calls["call-1"].participants["bia"] = &participantState{userID: "bia"}
	s.mu.Unlock()
	if s.InviteValid("call-1", "bia", false) {
		t.Fatal("quem já está na call não tem convite válido")
	}
	if _, err := s.OpenFriendInvite("call-1", "bia"); !errors.Is(err, ErrInviteInvalid) {
		t.Fatalf("Open: err = %v", err)
	}
}

func TestInviteValidityIsPerPerson(t *testing.T) {
	s, _ := inviteService(&fakePublisher{})
	_, _ = s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	if s.InviteValid("call-1", "caio", false) {
		t.Fatal("quem não foi convidado não tem convite válido")
	}
	// O cartão de quem convidou só depende de a call existir.
	if !s.InviteValid("call-1", "ana", true) {
		t.Fatal("cartão do convidador vale enquanto a call durar")
	}
}

func TestReinviteAfterUseWorksEvenInsideResendWindow(t *testing.T) {
	pub := &fakePublisher{}
	s, poster := inviteService(pub)
	_, _ = s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	_ = s.joinForTest("call-1", "bia")
	_, _ = s.detachForTest("call-1", "bia")
	res, _ := s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	if got := statusOf(res, "bia"); got != InviteSent || poster.postedTo("bia") != 2 {
		t.Fatalf("reconvite = %q (posts %d)", got, poster.postedTo("bia"))
	}
	if !s.InviteValid("call-1", "bia", false) {
		t.Fatal("o convite novo vale")
	}
}

// detachForTest tira o usuário da call sem encerrar nada.
func (s *Service) detachForTest(callID, userID string) (int, error) {
	n, _, err := s.detachParticipant(callID, userID)
	return n, err
}

// joinForTest entra pelo joinLocked de verdade (passe da sala trancada
// gasto como no Join) e devolve o erro.
func (s *Service) joinForTest(callID, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	ac := s.calls[callID]
	canEnterLockedLocked(ac, userID, time.Now())
	s.addParticipant = func(context.Context, *CallParticipant) error { return nil }
	_, err := s.joinLocked(context.Background(), ac, userID, RoleMember)
	return err
}

func TestJoinLockedErrorsAndIdempotence(t *testing.T) {
	s, _ := inviteService(&fakePublisher{})
	if err := s.joinForTest("call-1", "ana"); err != nil {
		t.Fatalf("quem já está dentro: %v", err)
	}
	s.busy["bia"] = "outra-call"
	if err := s.joinForTest("call-1", "bia"); !errors.Is(err, ErrBusy) {
		t.Fatalf("ocupado em outra call: err = %v", err)
	}
	delete(s.busy, "bia")
	s.lookupUser = func(context.Context, string) (UserInfo, error) { return UserInfo{}, errors.New("sem usuário") }
	if err := s.joinForTest("call-1", "bia"); err == nil {
		t.Fatal("falha ao buscar o usuário deveria barrar a entrada")
	}
	s.calls["call-1"].info.Status = StatusEnded
	if err := s.joinForTest("call-1", "caio"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("call acabada: err = %v", err)
	}
}
