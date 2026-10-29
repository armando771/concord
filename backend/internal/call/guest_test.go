package call

import (
	"context"
	"errors"
	"strings"
	"testing"

	"gin-quickstart/backend/internal/channel"
	"gin-quickstart/backend/internal/permission"
)

// guestPass: o canal de voz permitido e as permissões que o convite deu.
type guestPass struct {
	serverID, channelID string
	perms               int64
}

// fakeGuests faz o papel do internal/guest: visitante -> acesso.
type fakeGuests struct {
	passes map[string]guestPass
	// refuseMove: o visitante não tem acesso no servidor de destino.
	refuseMove bool
}

func (f *fakeGuests) GuestChannelPerms(_ context.Context, channelID, userID string) (int64, bool) {
	p, ok := f.passes[userID]
	if !ok || p.channelID != channelID {
		return 0, false
	}
	return permission.ViewChannel | permission.Connect | p.perms, true
}

func (f *fakeGuests) GuestOf(userID string) string {
	return f.passes[userID].serverID
}

func (f *fakeGuests) MoveGuest(_ context.Context, userID, serverID, channelID string) bool {
	p, ok := f.passes[userID]
	if f.refuseMove || !ok || p.serverID != serverID {
		return false
	}
	p.channelID = channelID
	f.passes[userID] = p
	return true
}

// newGuestService: o servidor de voiceSnapshot com "visita" (sem conta no
// servidor) convidada para o canal geral, podendo falar mas não transmitir.
func newGuestService() (*Service, *fakeGuests, *fakeMedia, *capPublisher) {
	svc, media, pub := newVoiceService(voiceSnapshot().WithChannel("jogos", permission.ChannelVoice))
	guests := &fakeGuests{passes: map[string]guestPass{
		"visita": {serverID: "srv-1", channelID: "geral", perms: permission.Speak},
	}}
	svc.SetGuests(guests)
	svc.findChannel = func(_ context.Context, id string) (*channel.Channel, error) {
		return &channel.Channel{ID: id, ServerID: "srv-1", Name: id, Type: channel.TypeVoice}, nil
	}
	return svc, guests, media, pub
}

func TestGuestEntersOnlyTheInvitedChannel(t *testing.T) {
	svc, _, _, _ := newGuestService()
	ctx := context.Background()
	if err := svc.requireConnect(ctx, "geral", "visita"); err != nil {
		t.Fatalf("visitante devia entrar no canal do convite: %v", err)
	}
	for _, ch := range []string{"jogos", "palco", "vip-voz"} {
		if err := svc.requireConnect(ctx, ch, "visita"); !errors.Is(err, ErrNotMember) {
			t.Errorf("visitante em %s: err = %v, want ErrNotMember", ch, err)
		}
	}
	if err := svc.requireConnect(ctx, "geral", "estranho"); !errors.Is(err, ErrNotMember) {
		t.Errorf("sem convite: err = %v, want ErrNotMember", err)
	}
}

func TestGuestMediaFollowsTheInvite(t *testing.T) {
	svc, _, _, _ := newGuestService()
	putInCall(svc, "c1", "geral", "visita", "ana")
	got := svc.GrantFor(context.Background(), "c1", "visita")
	if got.NoSpeak || !got.NoStream || got.NoSubscribe {
		t.Fatalf("grant = %+v, want falar sim, transmitir não, ouvir sim", got)
	}
}

func TestGuestSurvivesPermissionRevalidation(t *testing.T) {
	svc, guests, media, _ := newGuestService()
	putInCall(svc, "c1", "geral", "visita", "ana")
	ctx := context.Background()

	svc.RevalidateServer(ctx, "srv-1")
	if !svc.IsParticipant("c1", "visita") {
		t.Fatal("mudar cargos do servidor não pode tirar o visitante da call")
	}
	for _, u := range media.updates {
		if u.identity == "visita" && (u.grant.NoSpeak || !u.grant.NoStream) {
			t.Fatalf("grant do visitante = %+v, want o do convite", u.grant)
		}
	}

	// Acesso acabou (expirou ou foi revogado): a próxima revalidação tira.
	delete(guests.passes, "visita")
	svc.RevalidateServer(ctx, "srv-1")
	if svc.IsParticipant("c1", "visita") {
		t.Fatal("sem acesso, o visitante sai da call")
	}
}

func TestModeratorMutesGuestKeepingInvitePerms(t *testing.T) {
	svc, _, media, _ := newGuestService()
	putInCall(svc, "c1", "geral", "visita", "mod")
	if err := svc.SetServerMute(context.Background(), "c1", "mod", "visita", true); err != nil {
		t.Fatalf("moderador silencia visitante: %v", err)
	}
	last := media.updates[len(media.updates)-1]
	if !last.grant.NoSpeak || !last.grant.NoStream {
		t.Fatalf("grant = %+v, want silenciado e ainda sem transmitir", last.grant)
	}
	if err := svc.DisconnectParticipant(context.Background(), "c1", "mod", "visita"); err != nil {
		t.Fatalf("moderador desconecta visitante: %v", err)
	}
	if err := svc.SetServerMute(context.Background(), "c1", "visita", "mod", true); err == nil {
		t.Fatal("visitante não modera ninguém")
	}
}

func TestModeratorMovesGuestAndTheAccessFollows(t *testing.T) {
	svc, guests, _, pub := newGuestService()
	putInCall(svc, "c1", "geral", "visita", "mod")
	putInCall(svc, "c2", "jogos", "ana")
	ctx := context.Background()

	call, err := svc.MoveToChannel(ctx, "mod", "visita", "jogos")
	if err != nil {
		t.Fatalf("mover visitante: %v", err)
	}
	if call.ID != "c2" || !svc.IsParticipant("c2", "visita") || svc.IsParticipant("c1", "visita") {
		t.Fatalf("visitante devia estar só em c2 (call = %s)", call.ID)
	}
	if guests.passes["visita"].channelID != "jogos" {
		t.Fatalf("acesso continua em %s, want jogos", guests.passes["visita"].channelID)
	}
	if !pub.sentTo("visita", "call:moved") {
		t.Fatal("o visitante tem que saber que foi movido (o app troca de sala)")
	}
	// Agora o canal antigo não vale mais.
	if err := svc.requireConnect(ctx, "geral", "visita"); err == nil {
		t.Fatal("depois de movido, o canal antigo não vale mais")
	}
}

func TestMoveGuestRefusedLeavesHimWhereHeWas(t *testing.T) {
	svc, guests, _, _ := newGuestService()
	guests.refuseMove = true
	putInCall(svc, "c1", "geral", "visita", "mod")
	putInCall(svc, "c2", "jogos", "ana")

	if _, err := svc.MoveToChannel(context.Background(), "mod", "visita", "jogos"); !errors.Is(err, ErrTargetCannotJoin) {
		t.Fatalf("err = %v, want ErrTargetCannotJoin", err)
	}
	if !svc.IsParticipant("c1", "visita") {
		t.Fatal("mover recusado não tira ninguém da call")
	}
}

func TestMoveMemberStillWorks(t *testing.T) {
	svc, _, _, _ := newGuestService()
	putInCall(svc, "c1", "geral", "ana", "mod")
	putInCall(svc, "c2", "jogos", "vip")
	if _, err := svc.MoveToChannel(context.Background(), "mod", "ana", "jogos"); err != nil {
		t.Fatalf("mover membro: %v", err)
	}
	if !svc.IsParticipant("c2", "ana") {
		t.Fatal("ana devia estar em c2")
	}
	if _, err := svc.MoveToChannel(context.Background(), "ana", "vip", "geral"); !errors.Is(err, ErrNotModerator) {
		t.Fatalf("membro comum movendo: err = %v", err)
	}
}

func TestGuestBadgeGoesWithTheUserInfo(t *testing.T) {
	svc, _, _, _ := newGuestService()
	ctx := context.Background()
	if info, _ := svc.lookupUser(ctx, "visita"); info.GuestOf != "srv-1" {
		t.Fatalf("GuestOf = %q, want srv-1", info.GuestOf)
	}
	if info, _ := svc.lookupUser(ctx, "ana"); info.GuestOf != "" {
		t.Fatalf("membro não é visitante: %q", info.GuestOf)
	}
}

// sentTo: algum evento do tipo typ foi para o usuário.
func (p *capPublisher) sentTo(userID, typ string) bool {
	for _, ev := range p.userEvents[userID] {
		if strings.Contains(string(ev), `"type":"`+typ+`"`) {
			return true
		}
	}
	return false
}
