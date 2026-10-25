package user

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgconn"
)

// Erros de validação do cadastro (400). Mesmas regras da tela de cadastro.
var (
	ErrInvalidUsername     = errors.New("username must be 3-32 letters, numbers or _")
	ErrDisplayNameRequired = errors.New("display name is required")
	ErrDisplayNameTooLong  = errors.New("display name is too long")
	ErrInvalidEmail        = errors.New("invalid email")
	ErrPasswordTooShort    = errors.New("password must have at least 8 characters")
)

// ErrIdentityTaken: já existe conta com esse nome de usuário ou e-mail, sem
// diferenciar maiúsculas/minúsculas. Uma mensagem só para os dois casos.
var ErrIdentityTaken = errors.New("username or email already in use")

var (
	usernamePattern = regexp.MustCompile(`^[a-zA-Z0-9_]{3,32}$`)
	emailPattern    = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
)

// Registration é o que chega no POST /auth/register.
type Registration struct {
	Username    string
	DisplayName string
	Email       string
	Password    string
}

// NormalizeRegistration tira os espaços das pontas (menos da senha), como a
// tela de cadastro já faz.
func NormalizeRegistration(r Registration) Registration {
	r.Username = strings.TrimSpace(r.Username)
	r.DisplayName = strings.TrimSpace(r.DisplayName)
	r.Email = strings.TrimSpace(r.Email)
	return r
}

// ValidateRegistration aplica no servidor as regras da tela de cadastro (e os
// tamanhos das colunas). Sem "@" no nome de usuário, o login nunca confunde
// usuário com e-mail.
func ValidateRegistration(r Registration) error {
	if !usernamePattern.MatchString(r.Username) {
		return ErrInvalidUsername
	}
	if r.DisplayName == "" {
		return ErrDisplayNameRequired
	}
	if utf8.RuneCountInString(r.DisplayName) > 64 {
		return ErrDisplayNameTooLong
	}
	if utf8.RuneCountInString(r.Email) > 255 || !emailPattern.MatchString(r.Email) {
		return ErrInvalidEmail
	}
	if utf8.RuneCountInString(r.Password) < 8 {
		return ErrPasswordTooShort
	}
	return nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// CaseConflictWarning é o aviso do boot quando há contas que só diferem na
// caixa (sem listar nomes). Vazio quando não há nenhuma.
func CaseConflictWarning(usernameGroups, emailGroups int) string {
	if usernameGroups == 0 && emailGroups == 0 {
		return ""
	}
	msg := fmt.Sprintf(
		"WARNING: %d grupo(s) de usernames e %d grupo(s) de e-mails que só diferem na caixa; "+
			"o login dessas contas só funciona com a caixa exata.",
		usernameGroups, emailGroups,
	)
	if usernameGroups > 0 {
		msg += " Por isso a migration 000021 não criou o índice único em lower(username) (caiu no índice comum)."
	}
	return msg + " Resolva os duplicados: veja docs/HOSPEDAGEM.md (\"Nomes de usuário sem diferenciar caixa\")."
}
