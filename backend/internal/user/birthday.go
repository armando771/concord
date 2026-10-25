package user

import (
	"context"
	"errors"
	"time"
)

var ErrInvalidBirthday = errors.New("data de aniversário inválida")

// Birthday: aniversário opcional (só dia e mês, para não revelar a idade) e
// se os servidores podem anunciar.
type Birthday struct {
	Day      *int `json:"day"`
	Month    *int `json:"month"`
	Announce bool `json:"announce"`
}

// ValidateBirthday: os dois vazios (sem aniversário) ou uma data que existe
// em algum ano (29/02 vale).
func ValidateBirthday(day, month *int) error {
	if day == nil && month == nil {
		return nil
	}
	if day == nil || month == nil || *month < 1 || *month > 12 || *day < 1 {
		return ErrInvalidBirthday
	}
	// 2024 é bissexto: aceita 29 de fevereiro.
	last := time.Date(2024, time.Month(*month)+1, 0, 0, 0, 0, 0, time.UTC).Day()
	if *day > last {
		return ErrInvalidBirthday
	}
	return nil
}

func (r *Repository) GetBirthday(ctx context.Context, userID string) (*Birthday, error) {
	b := &Birthday{}
	err := r.db.QueryRow(
		ctx,
		`SELECT birthday_day, birthday_month, announce_birthday FROM users WHERE id = $1`,
		userID,
	).Scan(&b.Day, &b.Month, &b.Announce)
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
		SET birthday_day = $2, birthday_month = $3, announce_birthday = $4, updated_at = NOW()
		WHERE id = $1
		`,
		userID,
		b.Day,
		b.Month,
		b.Announce,
	)
	return err
}

func (s *Service) GetBirthday(ctx context.Context, userID string) (*Birthday, error) {
	return s.repository.GetBirthday(ctx, userID)
}

func (s *Service) SetBirthday(ctx context.Context, userID string, b Birthday) error {
	if err := ValidateBirthday(b.Day, b.Month); err != nil {
		return err
	}
	return s.repository.SetBirthday(ctx, userID, b)
}
