package livekit

import (
	"reflect"
	"testing"

	"github.com/livekit/protocol/auth"
)

const (
	testKey    = "concord"
	testSecret = "segredo-de-teste-com-tamanho-suficiente-123"
)

func TestIssueTokenCarriesRoomAndIdentity(t *testing.T) {
	issuer := NewTokenIssuer(testKey, testSecret)

	raw, err := issuer.Issue("call-123", "user-1", "Fulano", Grant{})
	if err != nil {
		t.Fatalf("Issue: %v", err)
	}

	verifier, err := auth.ParseAPIToken(raw)
	if err != nil {
		t.Fatalf("ParseAPIToken: %v", err)
	}
	if verifier.APIKey() != testKey {
		t.Fatalf("api key = %q, want %q", verifier.APIKey(), testKey)
	}
	_, grants, err := verifier.Verify(testSecret)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if grants.Identity != "user-1" {
		t.Errorf("identity = %q, want user-1", grants.Identity)
	}
	if grants.Name != "Fulano" {
		t.Errorf("name = %q, want Fulano", grants.Name)
	}
	if grants.Video == nil || !grants.Video.RoomJoin || grants.Video.Room != "call-123" {
		t.Errorf("video grant = %+v, want roomJoin on call-123", grants.Video)
	}
}

func TestIssueTokenRejectsWrongSecret(t *testing.T) {
	raw, err := NewTokenIssuer(testKey, testSecret).Issue("call-123", "user-1", "Fulano", Grant{})
	if err != nil {
		t.Fatalf("Issue: %v", err)
	}
	verifier, err := auth.ParseAPIToken(raw)
	if err != nil {
		t.Fatalf("ParseAPIToken: %v", err)
	}
	if _, _, err := verifier.Verify("outro-segredo-qualquer-com-tamanho-ok"); err == nil {
		t.Fatal("expected verification with wrong secret to fail")
	}
}

func verifyGrant(t *testing.T, g Grant) *auth.VideoGrant {
	t.Helper()
	raw, err := NewTokenIssuer(testKey, testSecret).Issue("call-1", "user-1", "Fulano", g)
	if err != nil {
		t.Fatal(err)
	}
	verifier, err := auth.ParseAPIToken(raw)
	if err != nil {
		t.Fatal(err)
	}
	_, grants, err := verifier.Verify(testSecret)
	if err != nil {
		t.Fatal(err)
	}
	return grants.Video
}

func TestIssueTokenGrantsBySource(t *testing.T) {
	cases := map[string]struct {
		grant     Grant
		sources   []string
		subscribe bool
	}{
		"completo":       {Grant{}, []string{"microphone", "camera", "screen_share", "screen_share_audio"}, true},
		"sem falar":      {Grant{NoSpeak: true}, []string{"camera", "screen_share", "screen_share_audio"}, true},
		"sem transmitir": {Grant{NoStream: true}, []string{"microphone"}, true},
		"ensurdecido":    {Grant{NoSubscribe: true}, []string{"microphone", "camera", "screen_share", "screen_share_audio"}, false},
	}
	for name, tc := range cases {
		video := verifyGrant(t, tc.grant)
		if !reflect.DeepEqual(video.CanPublishSources, tc.sources) {
			t.Errorf("%s: fontes = %v, want %v", name, video.CanPublishSources, tc.sources)
		}
		if video.CanSubscribe == nil || *video.CanSubscribe != tc.subscribe {
			t.Errorf("%s: canSubscribe = %v, want %v", name, video.CanSubscribe, tc.subscribe)
		}
		if video.CanPublishData == nil || !*video.CanPublishData {
			t.Errorf("%s: dados (chat) sempre liberados", name)
		}
	}
}

func TestGrantPermissionMirrorsToken(t *testing.T) {
	p := Grant{NoSpeak: true, NoStream: true, NoSubscribe: true}.Permission()
	if p.CanPublish || p.CanSubscribe || len(p.CanPublishSources) != 0 {
		t.Fatalf("sem nada: %+v", p)
	}
	p = Grant{NoSpeak: true}.Permission()
	if !p.CanPublish || len(p.CanPublishSources) != 3 {
		t.Fatalf("sem falar mas com tela: %+v", p)
	}
}

func TestIssueBotTokenPublishesOnly(t *testing.T) {
	issuer := NewTokenIssuer(testKey, testSecret)
	raw, err := issuer.IssueBot("call-1", "bot-music:ch1", "Maestro")
	if err != nil {
		t.Fatal(err)
	}
	verifier, err := auth.ParseAPIToken(raw)
	if err != nil {
		t.Fatal(err)
	}
	_, grants, err := verifier.Verify(testSecret)
	if err != nil {
		t.Fatal(err)
	}
	v := grants.Video
	if grants.Identity != "bot-music:ch1" || v == nil || v.Room != "call-1" || !v.RoomJoin {
		t.Fatalf("grants = %+v", grants)
	}
	if v.CanSubscribe == nil || *v.CanSubscribe {
		t.Fatal("o bot não pode assinar (não escuta ninguém)")
	}
	if v.CanPublish == nil || !*v.CanPublish {
		t.Fatal("o bot precisa publicar")
	}
}
