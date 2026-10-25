package user

import (
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestValidateRegistration(t *testing.T) {
	ok := []Registration{
		{Username: "nicccls", DisplayName: "Nic", Email: "nic@exemplo.com", Password: "12345678"},
		{Username: "SHACO_2", DisplayName: "S", Email: "a@b.co", Password: "senha longa"},
		{Username: strings.Repeat("a", 32), DisplayName: strings.Repeat("é", 64), Email: "x@y.z", Password: "çççççççç"},
	}
	for _, r := range ok {
		if err := ValidateRegistration(r); err != nil {
			t.Errorf("ValidateRegistration(%+v) = %v, want nil", r, err)
		}
	}

	base := Registration{Username: "nicccls", DisplayName: "Nic", Email: "nic@exemplo.com", Password: "12345678"}
	bad := []struct {
		name string
		edit func(*Registration)
		want error
	}{
		{"usuário curto", func(r *Registration) { r.Username = "ab" }, ErrInvalidUsername},
		{"usuário longo", func(r *Registration) { r.Username = strings.Repeat("a", 33) }, ErrInvalidUsername},
		{"usuário com @", func(r *Registration) { r.Username = "a@b" }, ErrInvalidUsername},
		{"usuário com @ na frente", func(r *Registration) { r.Username = "@nicccls" }, ErrInvalidUsername},
		{"usuário com espaço", func(r *Registration) { r.Username = "nic cls" }, ErrInvalidUsername},
		{"usuário com acento", func(r *Registration) { r.Username = "joão" }, ErrInvalidUsername},
		{"sem nome de exibição", func(r *Registration) { r.DisplayName = "" }, ErrDisplayNameRequired},
		{"nome de exibição longo", func(r *Registration) { r.DisplayName = strings.Repeat("a", 65) }, ErrDisplayNameTooLong},
		{"e-mail sem @", func(r *Registration) { r.Email = "admin" }, ErrInvalidEmail},
		{"e-mail sem domínio com ponto", func(r *Registration) { r.Email = "a@b" }, ErrInvalidEmail},
		{"e-mail com espaço", func(r *Registration) { r.Email = "a b@c.com" }, ErrInvalidEmail},
		{"e-mail com dois @", func(r *Registration) { r.Email = "a@b@c.com" }, ErrInvalidEmail},
		{"e-mail longo", func(r *Registration) { r.Email = strings.Repeat("a", 250) + "@b.com" }, ErrInvalidEmail},
		{"senha curta", func(r *Registration) { r.Password = "1234567" }, ErrPasswordTooShort},
	}
	for _, c := range bad {
		t.Run(c.name, func(t *testing.T) {
			r := base
			c.edit(&r)
			if err := ValidateRegistration(r); !errors.Is(err, c.want) {
				t.Errorf("ValidateRegistration(%+v) = %v, want %v", r, err, c.want)
			}
		})
	}
}

func TestNormalizeRegistrationTrims(t *testing.T) {
	r := NormalizeRegistration(Registration{Username: "  nicccls ", DisplayName: " Nic ", Email: " nic@exemplo.com ", Password: " senha "})
	want := Registration{Username: "nicccls", DisplayName: "Nic", Email: "nic@exemplo.com", Password: " senha "}
	if r != want {
		t.Errorf("NormalizeRegistration = %+v, want %+v", r, want)
	}
}

func TestIsUniqueViolation(t *testing.T) {
	if !isUniqueViolation(fmt.Errorf("insert: %w", &pgconn.PgError{Code: "23505"})) {
		t.Error("23505 embrulhado deveria contar")
	}
	if isUniqueViolation(&pgconn.PgError{Code: "23502"}) || isUniqueViolation(errors.New("x")) || isUniqueViolation(nil) {
		t.Error("só 23505 conta")
	}
}

func TestCaseConflictWarning(t *testing.T) {
	if got := CaseConflictWarning(0, 0); got != "" {
		t.Errorf("sem conflito: %q, want vazio", got)
	}
	got := CaseConflictWarning(2, 1)
	for _, want := range []string{"WARNING", "2", "1", "lower(username)"} {
		if !strings.Contains(got, want) {
			t.Errorf("CaseConflictWarning(2, 1) = %q, falta %q", got, want)
		}
	}
	if got := CaseConflictWarning(0, 3); !strings.Contains(got, "3") || !strings.Contains(got, "WARNING") {
		t.Errorf("só e-mail: %q", got)
	}
}
