package user

import (
	"errors"
	"testing"
	"time"
)

func ptr(n int) *int { return &n }

var now = time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)

func TestValidateBirthday(t *testing.T) {
	ok := []struct{ day, month, year *int }{
		{nil, nil, nil},
		{ptr(25), ptr(10), ptr(2000)},
		{ptr(29), ptr(2), ptr(2004)},
		{ptr(31), ptr(12), ptr(1990)},
		{ptr(25), ptr(10), ptr(2026)}, // nasceu hoje
	}
	for _, c := range ok {
		if err := ValidateBirthday(c.day, c.month, c.year, now); err != nil {
			t.Errorf("ValidateBirthday(%v,%v,%v) = %v, want nil", c.day, c.month, c.year, err)
		}
	}

	bad := []struct {
		name             string
		day, month, year *int
	}{
		{"30/02", ptr(30), ptr(2), ptr(2000)},
		{"29/02 em ano não bissexto", ptr(29), ptr(2), ptr(2001)},
		{"31/04", ptr(31), ptr(4), ptr(2000)},
		{"dia 0", ptr(0), ptr(1), ptr(2000)},
		{"mês 13", ptr(1), ptr(13), ptr(2000)},
		{"antes de 1900", ptr(1), ptr(1), ptr(1899)},
		{"no futuro", ptr(26), ptr(10), ptr(2026)},
		{"sem ano", ptr(10), ptr(5), nil},
		{"só o ano", nil, nil, ptr(2000)},
		{"sem mês", ptr(10), nil, ptr(2000)},
	}
	for _, c := range bad {
		if err := ValidateBirthday(c.day, c.month, c.year, now); !errors.Is(err, ErrInvalidBirthday) {
			t.Errorf("%s: err = %v, want ErrInvalidBirthday", c.name, err)
		}
	}
}
