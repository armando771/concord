package auth

import "strings"

// IdentifierKind diz por qual coluna o login procura a conta.
type IdentifierKind int

const (
	IdentifierEmail IdentifierKind = iota
	IdentifierUsername
)

// LoginIdentifier é o que a pessoa digitou no campo "E-mail ou nome de usuário".
type LoginIdentifier struct {
	Kind  IdentifierKind
	Value string
}

// ParseLoginIdentifier decide se o login é por e-mail ou por nome de usuário.
//
// login é o campo novo; email é o campo antigo, que os apps desktop já
// instalados continuam mandando — usado só quando login vem em branco.
// Com "@" é e-mail; "@nicccls" perde um "@" da frente e vira o usuário
// "nicccls". ok = false quando não sobra nada para procurar.
func ParseLoginIdentifier(login, email string) (LoginIdentifier, bool) {
	raw := strings.TrimSpace(login)
	if raw == "" {
		raw = strings.TrimSpace(email)
	}

	if rest, found := strings.CutPrefix(raw, "@"); found && !strings.Contains(rest, "@") {
		raw = rest
	}

	if raw == "" {
		return LoginIdentifier{}, false
	}
	if strings.Contains(raw, "@") {
		return LoginIdentifier{Kind: IdentifierEmail, Value: raw}, true
	}
	return LoginIdentifier{Kind: IdentifierUsername, Value: raw}, true
}
