package user

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"
)

// Troca do nome de usuário e do e-mail (Configurações → Minha conta). A senha
// atual é conferida antes, no auth (AccountHandler); aqui ficam as regras.

var (
	// ErrUsernameTaken: outra conta já usa esse nome (sem diferenciar caixa).
	ErrUsernameTaken = errors.New("esse nome de usuário já está em uso")
	// ErrUsernameReserved: @all, @here e @everyone são menções do chat.
	ErrUsernameReserved = errors.New("esse nome de usuário é reservado")
	// ErrEmailTaken: outra conta já usa esse e-mail (sem diferenciar caixa).
	ErrEmailTaken = errors.New("esse e-mail já está em uso")
)

// maxEmailChars é o tamanho da coluna (o mesmo limite do cadastro).
const maxEmailChars = 255

type accountRepo interface {
	FindByID(ctx context.Context, id string) (*User, error)
	UsernameTakenByOther(ctx context.Context, id, username string) (bool, error)
	EmailTakenByOther(ctx context.Context, id, email string) (bool, error)
	SetUsername(ctx context.Context, id, username string) (*User, error)
	SetEmail(ctx context.Context, id, email string, keepVerified bool) (*User, error)
}

// accountEvents avisa os outros clientes do @ novo (o hub implementa).
type accountEvents interface {
	PublishUserUpdate(profile PublicProfile)
	EffectiveStatus(userID string) string
}

// AccountService troca os dados de login da conta.
type AccountService struct {
	repo   accountRepo
	events accountEvents
}

func NewAccountService(repo accountRepo, events accountEvents) *AccountService {
	return &AccountService{repo: repo, events: events}
}

// NormalizeUsername aplica as regras do cadastro: sem espaços nas pontas, de
// 3 a 32 letras, números ou _, e nada de nome reservado.
func NormalizeUsername(raw string) (string, error) {
	username := strings.TrimSpace(raw)
	if !usernamePattern.MatchString(username) {
		return "", ErrInvalidUsername
	}
	if IsReservedUsername(username) {
		return "", ErrUsernameReserved
	}
	return username, nil
}

// NormalizeEmail aplica as regras do cadastro: sem espaços nas pontas, com
// cara de e-mail e cabendo na coluna.
func NormalizeEmail(raw string) (string, error) {
	email := strings.TrimSpace(raw)
	if utf8.RuneCountInString(email) > maxEmailChars || !emailPattern.MatchString(email) {
		return "", ErrInvalidEmail
	}
	return email, nil
}

// taken traduz a checagem de "já existe" (ou o UNIQUE do banco, numa corrida
// entre dois pedidos) no erro de conflito.
func taken(isTaken bool, err error, conflict error) error {
	if err != nil {
		return err
	}
	if isTaken {
		return conflict
	}
	return nil
}

func uniqueAs(err, conflict error) error {
	if isUniqueViolation(err) {
		return conflict
	}
	return err
}

// ChangeUsername troca o @ e avisa todo mundo (o @ aparece no cartão).
// Trocar só a caixa do próprio nome vale.
func (s *AccountService) ChangeUsername(ctx context.Context, userID, raw string) (*User, error) {
	username, err := NormalizeUsername(raw)
	if err != nil {
		return nil, err
	}
	current, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, notFound(err)
	}
	if current.Username == username {
		return current, nil
	}
	isTaken, err := s.repo.UsernameTakenByOther(ctx, userID, username)
	if err := taken(isTaken, err, ErrUsernameTaken); err != nil {
		return nil, err
	}
	u, err := s.repo.SetUsername(ctx, userID, username)
	if err != nil {
		return nil, uniqueAs(notFound(err), ErrUsernameTaken)
	}
	s.events.PublishUserUpdate(u.Public(s.events.EffectiveStatus(u.ID)))
	return u, nil
}

// ChangeEmail troca o e-mail. Um endereço novo volta a "não confirmado" e
// confirm = true (quem chama manda o link); só mudar a caixa mantém a
// confirmação. O e-mail é privado: ninguém mais é avisado.
func (s *AccountService) ChangeEmail(ctx context.Context, userID, raw string) (u *User, confirm bool, err error) {
	email, err := NormalizeEmail(raw)
	if err != nil {
		return nil, false, err
	}
	current, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, false, notFound(err)
	}
	if current.Email == email {
		return current, false, nil
	}
	isTaken, err := s.repo.EmailTakenByOther(ctx, userID, email)
	if err := taken(isTaken, err, ErrEmailTaken); err != nil {
		return nil, false, err
	}
	sameAddress := strings.EqualFold(current.Email, email)
	u, err = s.repo.SetEmail(ctx, userID, email, sameAddress)
	if err != nil {
		return nil, false, uniqueAs(notFound(err), ErrEmailTaken)
	}
	return u, !sameAddress, nil
}
