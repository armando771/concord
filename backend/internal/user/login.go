package user

import (
	"context"
	"errors"
)

// ErrLoginNotFound: nenhuma conta (ou mais de uma, sem desempate) para o login.
var ErrLoginNotFound = errors.New("login not found")

// loginColumn só aceita as constantes abaixo — vai direto no SQL.
type loginColumn string

const (
	loginByEmail    loginColumn = "email"
	loginByUsername loginColumn = "username"
)

// pickLoginMatch escolhe a conta do login entre os candidatos que batem com
// value ignorando maiúsculas/minúsculas.
//
// Nomes de usuário (e e-mails) nunca foram únicos sem diferenciar caixa, então
// "SHACO" e "shaco" podem ser contas diferentes. Por isso: quem bate
// exatamente ganha; senão, só aceita se houver um único candidato. Se for
// ambíguo, não escolhe ninguém — o login falha como "credenciais inválidas".
func pickLoginMatch(candidates []User, value string, field func(User) string) (*User, bool) {
	for i := range candidates {
		if field(candidates[i]) == value {
			return &candidates[i], true
		}
	}
	if len(candidates) == 1 {
		return &candidates[0], true
	}
	return nil, false
}

// FindLoginByEmail acha a conta do login por e-mail, sem diferenciar caixa.
func (s *Service) FindLoginByEmail(ctx context.Context, email string) (*User, error) {
	return s.findLogin(ctx, loginByEmail, email, func(u User) string { return u.Email })
}

// FindLoginByUsername acha a conta do login pelo nome de usuário, sem
// diferenciar caixa.
func (s *Service) FindLoginByUsername(ctx context.Context, username string) (*User, error) {
	return s.findLogin(ctx, loginByUsername, username, func(u User) string { return u.Username })
}

func (s *Service) findLogin(ctx context.Context, column loginColumn, value string, field func(User) string) (*User, error) {
	candidates, err := s.repository.FindLoginCandidates(ctx, column, value)
	if err != nil {
		return nil, err
	}
	match, ok := pickLoginMatch(candidates, value, field)
	if !ok {
		return nil, ErrLoginNotFound
	}
	return match, nil
}
