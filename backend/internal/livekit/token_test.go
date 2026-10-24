package livekit

import (
	"testing"

	"github.com/livekit/protocol/auth"
)

const (
	testKey    = "concord"
	testSecret = "segredo-de-teste-com-tamanho-suficiente-123"
)

func TestIssueTokenCarriesRoomAndIdentity(t *testing.T) {
	issuer := NewTokenIssuer(testKey, testSecret)

	raw, err := issuer.Issue("call-123", "user-1", "Fulano")
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
	raw, err := NewTokenIssuer(testKey, testSecret).Issue("call-123", "user-1", "Fulano")
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
