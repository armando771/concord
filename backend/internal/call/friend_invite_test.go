package call

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"gin-quickstart/backend/internal/permission"
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

// inviteService: ana está na chamada; bia, caio e davi são amigos dela e
// podem entrar; eli não é amiga.
func inviteService(pub *fakePublisher) *Service {
	s := lockedCallWith(pub, "ana")
	s.friends = fakeFriends{"ana:bia": true, "ana:caio": true, "ana:davi": true, "ana:fred": true}
	s.perms = fakeAccess{"bia": true, "caio": true, "davi": true, "eli": true}
	s.isOnline = func(string) bool { return true }
	return s
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
	pub := &fakePublisher{}
	s := inviteService(pub)

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
	if n := len(pub.eventsOf("call:friend_invite")); n != 1 {
		t.Fatalf("convites enviados = %d, want 1", n)
	}
}

func TestInviteManyInOneAction(t *testing.T) {
	pub := &fakePublisher{}
	s := inviteService(pub)

	res, err := s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia", "caio", "davi", "bia"})
	if err != nil || len(res) != 3 {
		t.Fatalf("res = %+v, err = %v", res, err)
	}
	if n := len(pub.eventsOf("call:friend_invite")); n != 3 {
		t.Fatalf("convites enviados = %d, want 3", n)
	}
}

func TestInvitePayloadIdentifiesInviterAndCall(t *testing.T) {
	pub := &fakePublisher{}
	s := inviteService(pub)
	if _, err := s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"}); err != nil {
		t.Fatal(err)
	}
	evs := pub.eventsOf("call:friend_invite")
	if len(evs) != 1 || evs[0].target != "user:bia" {
		t.Fatalf("eventos = %+v", evs)
	}
	var p FriendInviteEvent
	_ = json.Unmarshal(evs[0].event["payload"], &p)
	if p.CallID != "call-1" || p.By.ID != "ana" || p.ChannelID == nil || *p.ChannelID != "geral" || p.ExpiresAt.IsZero() {
		t.Fatalf("payload = %+v", p)
	}
}

func TestInviteRejectsDuplicatePending(t *testing.T) {
	pub := &fakePublisher{}
	s := inviteService(pub)
	_, _ = s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})

	res, _ := s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	if got := statusOf(res, "bia"); got != InviteAlreadyInvited {
		t.Fatalf("segundo convite = %q", got)
	}
	if n := len(pub.eventsOf("call:friend_invite")); n != 1 {
		t.Fatalf("convites enviados = %d, want 1", n)
	}
}

func TestInviteRejectsPeopleAlreadyInCall(t *testing.T) {
	s := inviteService(&fakePublisher{})
	s.calls["call-1"].participants["bia"] = &participantState{userID: "bia"}

	res, _ := s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	if got := statusOf(res, "bia"); got != InviteAlreadyInCall {
		t.Fatalf("bia = %q", got)
	}
}

func TestInviteRejectsOfflineBusyAndBlocked(t *testing.T) {
	s := inviteService(&fakePublisher{})
	s.isOnline = func(id string) bool { return id != "caio" }
	s.busy["davi"] = "outra-call"
	s.blockedCheck = func(_ context.Context, _, b string) (bool, error) { return b == "bia", nil }

	res, _ := s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia", "caio", "davi"})
	if statusOf(res, "bia") != InviteBlocked || statusOf(res, "caio") != InviteOffline || statusOf(res, "davi") != InviteBusy {
		t.Fatalf("res = %+v", res)
	}
}

func TestInviteRequiresParticipantAndChannelCall(t *testing.T) {
	s := inviteService(&fakePublisher{})
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
	s := inviteService(&fakePublisher{})
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

func TestAcceptInviteAdmitsAndNotifies(t *testing.T) {
	pub := &fakePublisher{}
	s := inviteService(pub)
	s.calls["call-1"].info.Locked = true
	_, _ = s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})

	if err := s.AcceptFriendInvite("call-1", "bia"); err != nil {
		t.Fatalf("Accept: %v", err)
	}
	updates := pub.eventsOf("call:friend_invite_update")
	if len(updates) != 2 {
		t.Fatalf("updates = %d, want 2 (convidador e convidado)", len(updates))
	}
	var p FriendInviteUpdateEvent
	_ = json.Unmarshal(updates[0].event["payload"], &p)
	if p.Status != InviteAccepted || p.UserID != "bia" {
		t.Fatalf("payload = %+v", p)
	}
	// O passe vale na sala trancada.
	s.mu.Lock()
	ok := canEnterLockedLocked(s.calls["call-1"], "bia", time.Now())
	s.mu.Unlock()
	if !ok {
		t.Fatal("aceitar deveria dar o passe de entrada")
	}
	if err := s.AcceptFriendInvite("call-1", "bia"); !errors.Is(err, ErrNoInvite) {
		t.Fatalf("aceitar de novo: err = %v", err)
	}
}

func TestDeclineInviteKeepsCallAndBlocksSpam(t *testing.T) {
	pub := &fakePublisher{}
	s := inviteService(pub)
	_, _ = s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})

	if err := s.DeclineFriendInvite("call-1", "bia"); err != nil {
		t.Fatalf("Decline: %v", err)
	}
	if _, ok := s.calls["call-1"]; !ok {
		t.Fatal("recusar convite não pode encerrar a chamada")
	}
	var p FriendInviteUpdateEvent
	_ = json.Unmarshal(pub.eventsOf("call:friend_invite_update")[0].event["payload"], &p)
	if p.Status != InviteDeclined {
		t.Fatalf("status = %q", p.Status)
	}
	res, _ := s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	if got := statusOf(res, "bia"); got != InviteCooldown {
		t.Fatalf("logo após recusar = %q, want cooldown", got)
	}
}

func TestInviteExpires(t *testing.T) {
	pub := &fakePublisher{}
	s := inviteService(pub)
	_, _ = s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	inv := s.calls["call-1"].invites.pending["bia"]

	s.expireInvite("call-1", "bia", inv)

	var p FriendInviteUpdateEvent
	_ = json.Unmarshal(pub.eventsOf("call:friend_invite_update")[0].event["payload"], &p)
	if p.Status != InviteExpired {
		t.Fatalf("status = %q", p.Status)
	}
	if err := s.AcceptFriendInvite("call-1", "bia"); !errors.Is(err, ErrNoInvite) {
		t.Fatalf("aceitar expirado: err = %v", err)
	}
	// Convite antigo (timer atrasado) não mexe num convite novo.
	res, _ := s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})
	if statusOf(res, "bia") != InviteSent {
		t.Fatalf("reconvidar após expirar = %+v", res)
	}
	s.expireInvite("call-1", "bia", inv)
	if _, ok := s.calls["call-1"].invites.pending["bia"]; !ok {
		t.Fatal("timer velho derrubou o convite novo")
	}
}

func TestClosingCallCancelsInvites(t *testing.T) {
	pub := &fakePublisher{}
	s := inviteService(pub)
	_, _ = s.InviteFriends(context.Background(), "call-1", "ana", []string{"bia"})

	if err := s.closeCall("call-1"); err != nil {
		t.Fatal(err)
	}
	var p FriendInviteUpdateEvent
	_ = json.Unmarshal(pub.eventsOf("call:friend_invite_update")[0].event["payload"], &p)
	if p.Status != InviteCancelled || p.UserID != "bia" {
		t.Fatalf("payload = %+v", p)
	}
}

func inviteRouter(s *Service, userID string) http.Handler {
	return tokenRouter(s, userID)
}

func TestInviteHandlerStatusCodes(t *testing.T) {
	s := inviteService(&fakePublisher{})
	cases := []struct {
		name, user, path, body string
		want                   int
	}{
		{"ok", "ana", "/api/calls/call-1/invites", `{"user_ids":["bia"]}`, http.StatusOK},
		{"payload inválido", "ana", "/api/calls/call-1/invites", `{`, http.StatusBadRequest},
		{"sem ninguém", "ana", "/api/calls/call-1/invites", `{"user_ids":[]}`, http.StatusBadRequest},
		{"não participante", "bia", "/api/calls/call-1/invites", `{"user_ids":["caio"]}`, http.StatusForbidden},
		{"call inexistente", "ana", "/api/calls/x/invites", `{"user_ids":["bia"]}`, http.StatusNotFound},
		{"aceitar sem convite", "caio", "/api/calls/call-1/invites/accept", ``, http.StatusNotFound},
		{"aceitar", "bia", "/api/calls/call-1/invites/accept", ``, http.StatusOK},
		{"recusar sem convite", "caio", "/api/calls/call-1/invites/decline", ``, http.StatusNotFound},
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, c.path, bytes.NewBufferString(c.body))
		inviteRouter(s, c.user).ServeHTTP(rec, req)
		if rec.Code != c.want {
			t.Errorf("%s: status = %d, want %d (%s)", c.name, rec.Code, c.want, rec.Body.String())
		}
	}
}
