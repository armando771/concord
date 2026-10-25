package user

import (
	"context"
	"errors"
	"time"
)

var ErrInvalidBirthday = errors.New("data de aniversário inválida")

// Birthday: aniversário opcional (dia, mês e ano; a idade só aparece para a
// própria pessoa) e se os servidores podem anunciar.
type Birthday struct {
	Day      *int `json:"day"`
	Month    *int `json:"month"`
	Year     *int `json:"year"`
	Announce bool `json:"announce"`
}

const minBirthYear = 1900

// ValidateBirthday: tudo vazio (sem aniversário) ou uma data que existe
// (29/02 só em ano bissexto), a partir de 1900 e que não está no futuro.
func ValidateBirthday(day, month, year *int, now time.Time) error {
	if day == nil && month == nil && year == nil {
		return nil
	}
	if day == nil || month == nil || year == nil || *month < 1 || *month > 12 || *day < 1 {
		return ErrInvalidBirthday
	}
	if *year < minBirthYear || *year > now.Year() {
		return ErrInvalidBirthday
	}
	date := time.Date(*year, time.Month(*month), *day, 0, 0, 0, 0, time.UTC)
	if date.Day() != *day || date.Month() != time.Month(*month) {
		return ErrInvalidBirthday // ex.: 31/04 ou 29/02 em ano não bissexto
	}
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	if date.After(today) {
		return ErrInvalidBirthday
	}
	return nil
}

func (r *Repository) GetBirthday(ctx context.Context, userID string) (*Birthday, error) {
	b := &Birthday{}
	err := r.db.QueryRow(
		ctx,
		`SELECT birthday_day, birthday_month, birthday_year, announce_birthday FROM users WHERE id = $1`,
		userID,
	).Scan(&b.Day, &b.Month, &b.Year, &b.Announce)
	if err != nil {
		return nil, err
	}
	return b, nil
}

func (r *Repository) SetBirthday(ctx context.Context, userID string, b Birthday) error {
	_, err := r.db.Exec(
		ctx,
		`
		UPDATE users
		SET birthday_day = $2, birthday_month = $3, birthday_year = $4, announce_birthday = $5, updated_at = NOW()
		WHERE id = $1
		`,
		userID,
		b.Day,
		b.Month,
		b.Year,
		b.Announce,
	)
	return err
}

func (s *Service) GetBirthday(ctx context.Context, userID string) (*Birthday, error) {
	return s.repository.GetBirthday(ctx, userID)
}

func (s *Service) SetBirthday(ctx context.Context, userID string, b Birthday) error {
	if err := ValidateBirthday(b.Day, b.Month, b.Year, time.Now()); err != nil {
		return err
	}
	return s.repository.SetBirthday(ctx, userID, b)
}
