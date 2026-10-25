package auth

import "testing"

func TestParseLoginIdentifier(t *testing.T) {
	cases := []struct {
		name         string
		login, email string
		wantKind     IdentifierKind
		wantValue    string
	}{
		{"e-mail no campo novo", "voce@exemplo.com", "", IdentifierEmail, "voce@exemplo.com"},
		{"usuário no campo novo", "nicccls", "", IdentifierUsername, "nicccls"},
		{"@ na frente vira usuário", "@nicccls", "", IdentifierUsername, "nicccls"},
		{"tira só um @ da frente", "@@nicccls", "", IdentifierEmail, "@@nicccls"},
		{"espaços em volta", "  @SHACO  ", "", IdentifierUsername, "SHACO"},
		{"e-mail com espaços", "  Voce@Exemplo.com ", "", IdentifierEmail, "Voce@Exemplo.com"},
		{"cliente antigo manda email", "", "voce@exemplo.com", IdentifierEmail, "voce@exemplo.com"},
		{"cliente antigo com usuário no campo email", "", "caiolucio360", IdentifierUsername, "caiolucio360"},
		{"campo novo tem prioridade", "nicccls", "outro@exemplo.com", IdentifierUsername, "nicccls"},
		{"campo novo em branco cai no email", "   ", "voce@exemplo.com", IdentifierEmail, "voce@exemplo.com"},
		{"@ no meio é e-mail", "@foo@bar.com", "", IdentifierEmail, "@foo@bar.com"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, ok := ParseLoginIdentifier(c.login, c.email)
			if !ok {
				t.Fatalf("ParseLoginIdentifier(%q, %q) ok = false, want true", c.login, c.email)
			}
			if got.Kind != c.wantKind || got.Value != c.wantValue {
				t.Errorf("ParseLoginIdentifier(%q, %q) = %+v, want {%v %q}", c.login, c.email, got, c.wantKind, c.wantValue)
			}
		})
	}
}

func TestParseLoginIdentifierRejectsEmpty(t *testing.T) {
	for _, c := range []struct{ login, email string }{
		{"", ""},
		{"   ", ""},
		{"", "  "},
		{"@", ""},
		{" @ ", ""},
	} {
		if got, ok := ParseLoginIdentifier(c.login, c.email); ok {
			t.Errorf("ParseLoginIdentifier(%q, %q) = %+v, want ok = false", c.login, c.email, got)
		}
	}
}
