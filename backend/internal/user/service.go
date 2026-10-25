package user

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

var (
	ErrUsernameRequired = errors.New("username is required")
	ErrEmailRequired    = errors.New("email is required")
)

type Service struct {
	repository *Repository
}

func UserService(repository *Repository) *Service {
	return &Service{
		repository: repository,
	}
}

func (s *Service) FindByID(ctx context.Context, id string) (*User, error) {
	return s.repository.FindByID(ctx, id)
}

func (s *Service) FindByUsername(ctx context.Context, username string) (*User, error) {
	return s.repository.FindByUsername(ctx, username)
}

func (s *Service) SearchByUsername(ctx context.Context, query string, excludeUserID string) ([]User, error) {
	return s.repository.SearchByUsername(ctx, query, excludeUserID)
}

func (s *Service) FindByEmail(ctx context.Context, email string) (*User, error) {
	return s.repository.FindByEmail(ctx, email)
}

func (s *Service) Create(
	ctx context.Context,
	user *User,
) error {
	if user.Username == "" {
		return ErrUsernameRequired
	}

	if user.Email == "" {
		return ErrEmailRequired
	}

	// De novo aqui (o handler já conferiu antes do bcrypt): fecha a janela
	// entre a checagem e o INSERT o máximo possível.
	if err := s.CheckAvailable(ctx, user.Username, user.Email); err != nil {
		return err
	}

	user.ID = uuid.New().String()

	if err := s.repository.Create(ctx, user); err != nil {
		// Dois cadastros ao mesmo tempo: quem perde cai no UNIQUE.
		if isUniqueViolation(err) {
			return ErrIdentityTaken
		}
		return err
	}
	return nil
}

// CheckAvailable devolve ErrIdentityTaken se o nome for reservado ou se já
// existir conta com esse username ou e-mail. O UNIQUE do banco só pega a
// caixa exata (e o índice em lower(username) pode não existir; ver migration
// 000025), então confere sem diferenciar caixa.
func (s *Service) CheckAvailable(ctx context.Context, username, email string) error {
	// Reservado responde como nome já usado (mesmo 409 genérico).
	if IsReservedUsername(username) {
		return ErrIdentityTaken
	}
	taken, err := s.repository.IdentityTaken(ctx, username, email)
	if err != nil {
		return err
	}
	if taken {
		return ErrIdentityTaken
	}
	return nil
}

// LoginIndexes diz se os índices da migration 000025 existem.
func (s *Service) LoginIndexes(ctx context.Context) (hasUsername, hasEmail bool, err error) {
	return s.repository.LoginIndexes(ctx)
}

// CaseConflicts conta os grupos de usernames e de e-mails que só diferem na
// caixa (para o aviso do boot).
func (s *Service) CaseConflicts(ctx context.Context) (usernameGroups, emailGroups int, err error) {
	return s.repository.CountCaseConflicts(ctx)
}
