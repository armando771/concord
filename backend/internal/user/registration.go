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
	// O bcrypt só aceita até 72 bytes (acima disso dava 500).
	ErrPasswordTooLong = errors.New("Senha muito longa (máx. 72 bytes)")
)

// maxPasswordBytes é o limite do bcrypt.
const maxPasswordBytes = 72

// PasswordTooLong diz se a senha passa do limite do bcrypt (em bytes).
func PasswordTooLong(password string) bool {
	return len(password) > maxPasswordBytes
}

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
	if PasswordTooLong(r.Password) {
		return ErrPasswordTooLong
	}
	return nil
}

// reservedUsernames são as menções especiais do chat (@all, @here,
// @everyone): ninguém novo pode se chamar assim. Contas antigas ficam como
// estão.
var reservedUsernames = []string{"all", "here", "everyone"}

// IsReservedUsername diz se o nome é reservado, sem diferenciar caixa.
func IsReservedUsername(username string) bool {
	for _, r := range reservedUsernames {
		if strings.EqualFold(username, r) {
			return true
		}
	}
	return false
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
		msg += " Por isso a migration 000025 não criou o índice único em lower(username) (caiu no índice comum)."
	}
	return msg + " Resolva os duplicados: veja docs/HOSPEDAGEM.md (\"Nomes de usuário sem diferenciar caixa\")."
}

// MissingLoginIndexesError é o ERROR do boot quando faltam os índices da
// migration 000025. O runner guarda só a maior versão aplicada e pula as
// menores: se uma de número maior rodou antes, ela nunca roda. Vazio quando está ok.
func MissingLoginIndexesError(hasUsernameIndex, hasEmailIndex bool) string {
	if hasUsernameIndex && hasEmailIndex {
		return ""
	}
	var missing []string
	if !hasUsernameIndex {
		missing = append(missing, "lower(username)")
	}
	if !hasEmailIndex {
		missing = append(missing, "lower(email)")
	}
	return "ERROR: faltam os índices do login em " + strings.Join(missing, " e ") +
		": a migration 000025 foi pulada (uma migration de número maior rodou antes e o runner pula versões" +
		" menores que a atual). O login funciona, mas sem índice e sem UNIQUE(lower(username))." +
		" Aplique à mão (é idempotente): psql \"$DATABASE_URL\" -f migrations/000025_add_login_lower_indexes.up.sql" +
		" e reinicie o backend; veja docs/HOSPEDAGEM.md (\"Nomes de usuário sem diferenciar caixa\")."
}
