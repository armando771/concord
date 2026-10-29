package guest

import (
	"strings"
	"testing"
)

func TestNewTokenIsStrongAndHashed(t *testing.T) {
	a, b := newToken(), newToken()
	if a == b || len(a) != tokenLength || !validToken(a) {
		t.Fatalf("tokens %q e %q: precisam ser aleatórios, com %d caracteres", a, b, tokenLength)
	}
	h1, h2 := hashToken(a), hashToken(a)
	if h1 == a || h1 != h2 || len(h1) != 64 {
		t.Fatal("o banco guarda o SHA-256 (hex) do token, nunca o token")
	}
}

func TestValidToken(t *testing.T) {
	ok := strings.Repeat("aZ0_-", 9)[:tokenLength]
	cases := map[string]bool{
		ok:                       true,
		ok[:tokenLength-1]:       false,
		ok + "a":                 false,
		ok[:tokenLength-1] + "/": false,
		"":                       false,
	}
	for token, want := range cases {
		if got := validToken(token); got != want {
			t.Errorf("validToken(%q) = %v, want %v", token, got, want)
		}
	}
}

func TestNormalizeDisplayName(t *testing.T) {
	cases := []struct {
		in, want string
		err      error
	}{
		{"  Ana   Maria ", "Ana Maria", nil},
		{"Zé", "Zé", nil},
		{"a", "", ErrInvalidName},
		{"   ", "", ErrInvalidName},
		{strings.Repeat("x", 33), "", ErrInvalidName},
		{strings.Repeat("ç", 32), strings.Repeat("ç", 32), nil},
		{"ana\u0000bob", "", ErrInvalidName},
		{"ana\nbob", "ana bob", nil},
		{"ana‮bob", "", ErrInvalidName},
	}
	for _, tc := range cases {
		got, err := normalizeDisplayName(tc.in)
		if got != tc.want || err != tc.err {
			t.Errorf("normalizeDisplayName(%q) = (%q, %v), want (%q, %v)", tc.in, got, err, tc.want, tc.err)
		}
	}
}

func TestGuestUsernameCannotCollideWithRegistration(t *testing.T) {
	u := newGuestUser("Ana")
	if !strings.HasPrefix(u.Username, "visitante-") || len(u.Username) > 32 {
		t.Fatalf("username = %q", u.Username)
	}
	// O cadastro só aceita [a-zA-Z0-9_]: o hífen garante que nunca colide.
	if !strings.Contains(u.Username, "-") || !strings.HasSuffix(u.Email, "@visitante.invalid") || u.DisplayName != "Ana" {
		t.Fatalf("usuário de visitante = %+v", u)
	}
}

func TestPassPermsNeverExceedTheInvite(t *testing.T) {
	p := Pass{Permissions: -1}
	if got := p.channelPerms(); got != basePerms|AllowedPerms {
		t.Fatalf("perms = %b, want só ver, conectar, falar e transmitir", got)
	}
	if got := (Pass{}).channelPerms(); got != basePerms {
		t.Fatalf("sem extras = %b, want ver e conectar", got)
	}
}
