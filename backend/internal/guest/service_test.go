package guest

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"gin-quickstart/backend/internal/permission"
)

func TestCreateInviteRules(t *testing.T) {
	w := newWorld()
	ctx := context.Background()
	cases := []struct {
		name  string
		actor string
		in    CreateInput
		want  error
	}{
		{"mod na call", "mod", CreateInput{ChannelID: "sala", Duration: "6h"}, nil},
		{"dono sempre pode", "dono", CreateInput{ChannelID: "sala", Duration: "24h"}, nil},
		{"sem a permissão", "ana", CreateInput{ChannelID: "sala", Duration: "2h"}, ErrMissingPermission},
		{"desconectar não basta para convidar", "seg", CreateInput{ChannelID: "sala", Duration: "2h"}, ErrMissingPermission},
		{"fora da call do canal", "mod", CreateInput{ChannelID: "outra", Duration: "2h"}, ErrNotInCall},
		{"prazo fora da lista", "mod", CreateInput{ChannelID: "sala", Duration: "48h"}, ErrInvalidDuration},
		{"canal de texto", "mod", CreateInput{ChannelID: "geral", Duration: "2h"}, ErrNotVoiceChannel},
		{"canal que não existe", "mod", CreateInput{ChannelID: "x", Duration: "2h"}, ErrNotFound},
		{"quem não é membro", "estranho", CreateInput{ChannelID: "sala", Duration: "2h"}, ErrNotMember},
	}
	for _, tc := range cases {
		_, err := w.svc.CreateInvite(ctx, tc.actor, tc.in)
		if !errors.Is(err, tc.want) {
			t.Errorf("%s: err = %v, want %v", tc.name, err, tc.want)
		}
	}
}

func TestCreatedInviteKeepsOnlyTheHash(t *testing.T) {
	w := newWorld()
	inv, err := w.svc.CreateInvite(context.Background(), "mod", CreateInput{ChannelID: "sala", Duration: "12h", CanSpeak: true, CanStream: true})
	if err != nil {
		t.Fatal(err)
	}
	if !validToken(inv.Token) || !inv.ExpiresAt.Equal(w.now.Add(12*time.Hour)) {
		t.Fatalf("convite = %+v", inv)
	}
	if inv.Permissions != permission.Speak|permission.Stream {
		t.Fatalf("perms = %b", inv.Permissions)
	}
	if _, ok := w.store.hashes[inv.Token]; ok {
		t.Fatal("o token puro não pode ir para o banco")
	}
}

func TestPreviewShowsNamesOnly(t *testing.T) {
	w := newWorld()
	inv := w.invite()
	p, err := w.svc.Preview(context.Background(), inv.Token)
	if err != nil {
		t.Fatal(err)
	}
	want := Preview{ServerName: "Salinha", ChannelName: "Sala", InviterName: "Nome de mod", ExpiresAt: inv.ExpiresAt, CanSpeak: true}
	if *p != want {
		t.Fatalf("prévia = %+v, want %+v", *p, want)
	}
	if _, err := w.svc.Preview(context.Background(), "curto"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("token inválido: %v", err)
	}
	if _, err := w.svc.Preview(context.Background(), newToken()); !errors.Is(err, ErrNotFound) {
		t.Fatalf("token desconhecido: %v", err)
	}
}

func TestJoinAsGuestCreatesSessionScopedToTheChannel(t *testing.T) {
	w := newWorld()
	inv := w.invite()
	ctx := context.Background()

	sess, err := w.svc.JoinAsGuest(ctx, inv.Token, "  Visita  Legal ")
	if err != nil {
		t.Fatal(err)
	}
	if sess.User.DisplayName != "Visita Legal" || !strings.HasPrefix(sess.Token, "sessao:"+sess.User.ID) {
		t.Fatalf("sessão = %+v", sess)
	}
	if sess.Pass.ChannelID != "sala" || sess.Pass.ChannelName != "Sala" || !sess.Pass.CanSpeak || sess.Pass.CanStream {
		t.Fatalf("acesso = %+v", sess.Pass)
	}
	// A sessão vence junto com o link.
	if !strings.HasSuffix(sess.Token, inv.ExpiresAt.Format(time.RFC3339)) {
		t.Fatalf("token devia vencer em %v: %s", inv.ExpiresAt, sess.Token)
	}
	perms, ok := w.svc.GuestChannelPerms(ctx, "sala", sess.User.ID)
	if !ok || perms != permission.ViewChannel|permission.Connect|permission.Speak {
		t.Fatalf("perms na sala = %b (%v)", perms, ok)
	}
	if _, ok := w.svc.GuestChannelPerms(ctx, "outra", sess.User.ID); ok {
		t.Fatal("visitante só vale no canal do convite")
	}
	if w.svc.GuestOf(sess.User.ID) != "srv" || w.svc.GuestOf("ana") != "" {
		t.Fatal("selo de visitante errado")
	}
}

func TestJoinAsGuestRefusals(t *testing.T) {
	w := newWorld()
	inv := w.invite()
	ctx := context.Background()

	if _, err := w.svc.JoinAsGuest(ctx, inv.Token, "x"); !errors.Is(err, ErrInvalidName) {
		t.Fatalf("nome curto: %v", err)
	}
	for i := 0; i < MaxGuestsPerInvite; i++ {
		if _, err := w.svc.JoinAsGuest(ctx, inv.Token, "Pessoa"); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := w.svc.JoinAsGuest(ctx, inv.Token, "Pessoa"); !errors.Is(err, ErrInviteFull) {
		t.Fatalf("link cheio: %v", err)
	}

	other := w.invite()
	w.now = w.now.Add(2 * time.Hour)
	if _, err := w.svc.JoinAsGuest(ctx, other.Token, "Atrasado"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("link vencido: %v", err)
	}
}

func TestJoinWithAccount(t *testing.T) {
	w := newWorld()
	inv := w.invite()
	ctx := context.Background()

	if _, err := w.svc.JoinWithAccount(ctx, inv.Token, "ana"); !errors.Is(err, ErrAlreadyMember) {
		t.Fatalf("membro: %v", err)
	}
	if _, err := w.svc.JoinWithAccount(ctx, inv.Token, "banido"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("banido não entra nem como visitante: %v", err)
	}
	pass, err := w.svc.JoinWithAccount(ctx, inv.Token, "bia")
	if err != nil || pass.ChannelID != "sala" {
		t.Fatalf("conta de fora entra como visitante: %+v, %v", pass, err)
	}
	// Saiu e voltou pelo mesmo link: o mesmo acesso.
	if _, err := w.svc.JoinWithAccount(ctx, inv.Token, "bia"); err != nil {
		t.Fatalf("voltar pelo link: %v", err)
	}
	if n, _ := w.store.CountPasses(ctx, inv.ID); n != 1 {
		t.Fatalf("voltar não cria outro acesso: %d", n)
	}

	// Expulso: não volta pelo link.
	if err := w.svc.EndGuest(ctx, "mod", "srv", "bia"); err != nil {
		t.Fatal(err)
	}
	if _, err := w.svc.JoinWithAccount(ctx, inv.Token, "bia"); !errors.Is(err, ErrAccessEnded) {
		t.Fatalf("expulso voltando: %v", err)
	}
}

func TestEndGuestKicksAndNotifies(t *testing.T) {
	w := newWorld()
	inv := w.invite()
	ctx := context.Background()
	if _, err := w.svc.JoinWithAccount(ctx, inv.Token, "bia"); err != nil {
		t.Fatal(err)
	}
	w.calls.in["bia"] = "sala"

	if err := w.svc.EndGuest(ctx, "ana", "srv", "bia"); !errors.Is(err, ErrMissingPermission) {
		t.Fatalf("membro comum não expulsa: %v", err)
	}
	if err := w.svc.EndGuest(ctx, "seg", "srv", "bia"); err != nil {
		t.Fatalf("quem desconecta membros expulsa visitante: %v", err)
	}
	if len(w.calls.removed) != 1 || w.calls.removed[0] != "srv|bia" {
		t.Fatalf("tirado das calls: %v", w.calls.removed)
	}
	if got := w.notify.sent["bia"]; len(got) != 1 || !strings.Contains(got[0], `"reason":"removed"`) {
		t.Fatalf("aviso: %v", got)
	}
	if _, ok := w.svc.GuestChannelPerms(ctx, "sala", "bia"); ok {
		t.Fatal("acesso devia ter acabado")
	}
	if err := w.svc.EndGuest(ctx, "seg", "srv", "bia"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expulsar de novo: %v", err)
	}
}

func TestRevokeInviteEndsEveryoneFromIt(t *testing.T) {
	w := newWorld()
	inv := w.invite()
	keep := w.invite()
	ctx := context.Background()
	a, _ := w.svc.JoinAsGuest(ctx, inv.Token, "Primeira")
	b, _ := w.svc.JoinAsGuest(ctx, inv.Token, "Segunda")
	c, _ := w.svc.JoinAsGuest(ctx, keep.Token, "Outra")

	if err := w.svc.RevokeInvite(ctx, "ana", inv.ID); !errors.Is(err, ErrMissingPermission) {
		t.Fatalf("membro comum revogando: %v", err)
	}
	if err := w.svc.RevokeInvite(ctx, "mod", inv.ID); err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{a.User.ID, b.User.ID} {
		if _, ok := w.svc.GuestChannelPerms(ctx, "sala", id); ok {
			t.Fatalf("%s continua com acesso", id)
		}
		if len(w.notify.sent[id]) != 1 || !strings.Contains(w.notify.sent[id][0], `"reason":"revoked"`) {
			t.Fatalf("%s não foi avisado: %v", id, w.notify.sent[id])
		}
	}
	if _, ok := w.svc.GuestChannelPerms(ctx, "sala", c.User.ID); !ok {
		t.Fatal("o outro link continua valendo")
	}
	if _, err := w.svc.Preview(ctx, inv.Token); !errors.Is(err, ErrNotFound) {
		t.Fatal("link revogado não abre mais")
	}
	if err := w.svc.RevokeInvite(ctx, "mod", "nao-existe"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("revogar inexistente: %v", err)
	}
}

func TestSweepEndsExpiredAccess(t *testing.T) {
	w := newWorld()
	inv := w.invite()
	ctx := context.Background()
	sess, _ := w.svc.JoinAsGuest(ctx, inv.Token, "Visita")
	w.calls.in[sess.User.ID] = "sala"

	w.now = w.now.Add(time.Hour)
	w.svc.Sweep(ctx)
	if len(w.calls.removed) != 0 {
		t.Fatal("dentro do prazo ninguém sai")
	}

	w.now = inv.ExpiresAt
	w.svc.Sweep(ctx)
	if len(w.calls.removed) != 1 || !strings.Contains(w.notify.sent[sess.User.ID][0], `"reason":"expired"`) {
		t.Fatalf("no fim do prazo o visitante sai e é avisado: %v %v", w.calls.removed, w.notify.sent)
	}
	if w.store.passes[w.svc.mustPassID(sess.User.ID, inv.ID)].EndedAt == nil {
		t.Fatal("o fim fica gravado")
	}
	if w.store.deleted == 0 {
		t.Fatal("o sweep também limpa os usuários de visitante antigos")
	}
}

func TestMoveGuestChangesTheAllowedChannel(t *testing.T) {
	w := newWorld()
	inv := w.invite()
	ctx := context.Background()
	sess, _ := w.svc.JoinAsGuest(ctx, inv.Token, "Visita")

	if !w.svc.MoveGuest(ctx, sess.User.ID, "srv", "outra") {
		t.Fatal("mover devia valer")
	}
	if _, ok := w.svc.GuestChannelPerms(ctx, "outra", sess.User.ID); !ok {
		t.Fatal("canal novo vale")
	}
	if _, ok := w.svc.GuestChannelPerms(ctx, "sala", sess.User.ID); ok {
		t.Fatal("canal antigo não vale mais")
	}
	if w.svc.MoveGuest(ctx, sess.User.ID, "outro-servidor", "x") {
		t.Fatal("sem acesso no servidor não move")
	}
	if got := w.svc.Passes(ctx, sess.User.ID); len(got) != 1 || got[0].ChannelID != "outra" {
		t.Fatalf("a tela do visitante descobre o canal novo: %+v", got)
	}
}

func TestListInvitesWithGuests(t *testing.T) {
	w := newWorld()
	inv := w.invite()
	ctx := context.Background()
	if _, err := w.svc.JoinAsGuest(ctx, inv.Token, "Visita"); err != nil {
		t.Fatal(err)
	}
	list, err := w.svc.ListInvites(ctx, "mod", "sala")
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].ID != inv.ID || !list[0].CanSpeak || len(list[0].Guests) != 1 || list[0].Guests[0].DisplayName != "Visita" {
		t.Fatalf("lista = %+v", list)
	}
	if _, err := w.svc.ListInvites(ctx, "ana", "sala"); !errors.Is(err, ErrMissingPermission) {
		t.Fatalf("membro comum listando: %v", err)
	}
}

func TestWarmReloadsActiveAccess(t *testing.T) {
	w := newWorld()
	inv := w.invite()
	ctx := context.Background()
	sess, _ := w.svc.JoinAsGuest(ctx, inv.Token, "Visita")

	// Reinício: serviço novo, mesmo banco.
	restarted := NewService(w.store, w.svc.perms, w.svc.dir, w.calls, w.notify, fakeTokens{})
	restarted.now = w.svc.now
	if err := restarted.Warm(ctx); err != nil {
		t.Fatal(err)
	}
	if _, ok := restarted.GuestChannelPerms(ctx, "sala", sess.User.ID); !ok {
		t.Fatal("depois do reinício o visitante continua com acesso")
	}
}

// mustPassID: o id do acesso de userID pelo convite.
func (s *Service) mustPassID(userID, inviteID string) string {
	p, err := s.store.PassFor(context.Background(), inviteID, userID)
	if err != nil {
		panic(err)
	}
	return p.ID
}
