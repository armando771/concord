package user

import (
	"errors"
	"testing"
)

func ptr(n int) *int { return &n }

func TestValidateBirthday(t *testing.T) {
	ok := []struct{ day, month *int }{
		{nil, nil},
		{ptr(25), ptr(10)},
		{ptr(29), ptr(2)},
		{ptr(31), ptr(12)},
	}
	for _, c := range ok {
		if err := ValidateBirthday(c.day, c.month); err != nil {
			t.Errorf("ValidateBirthday(%v,%v) = %v, want nil", c.day, c.month, err)
		}
	}

	bad := []struct{ day, month *int }{
		{ptr(30), ptr(2)},
		{ptr(31), ptr(4)},
		{ptr(0), ptr(1)},
		{ptr(1), ptr(13)},
		{ptr(10), nil},
		{nil, ptr(10)},
	}
	for _, c := range bad {
		if err := ValidateBirthday(c.day, c.month); !errors.Is(err, ErrInvalidBirthday) {
			t.Errorf("ValidateBirthday(%v,%v) = %v, want ErrInvalidBirthday", c.day, c.month, err)
		}
	}
}
