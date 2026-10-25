package media

import (
	"errors"
	"testing"
)

func TestHasRoom(t *testing.T) {
	cases := []struct {
		free, incoming, reserve uint64
		want                    bool
	}{
		{10 << 30, 25 << 20, 5 << 30, true},
		{5 << 30, 1, 5 << 30, false},
		{4 << 30, 0, 5 << 30, false},
		{5<<30 + 100, 100, 5 << 30, true},
	}
	for _, tc := range cases {
		if got := hasRoom(tc.free, tc.incoming, tc.reserve); got != tc.want {
			t.Fatalf("hasRoom(%d, %d, %d) = %v, want %v", tc.free, tc.incoming, tc.reserve, got, tc.want)
		}
	}
}

func TestReserveFromEnv(t *testing.T) {
	cases := map[string]uint64{"": 5 << 30, "10": 10 << 30, "abc": 5 << 30, "0": 0}
	for raw, want := range cases {
		if got := ReserveFromEnv(raw); got != want {
			t.Fatalf("ReserveFromEnv(%q) = %d, want %d", raw, got, want)
		}
	}
}

func TestSpaceUsesMeasuredFree(t *testing.T) {
	s := &Space{dir: "x", reserve: 5 << 30, free: func(string) (uint64, error) { return 6 << 30, nil }}
	if !s.HasRoom(25 << 20) {
		t.Fatal("6 GB livres e 5 GB de reserva deveriam caber 25 MB")
	}
	if s.HasRoom(2 << 30) {
		t.Fatal("2 GB não cabem acima da reserva")
	}
	s.free = func(string) (uint64, error) { return 0, errors.New("statfs falhou") }
	if s.HasRoom(1) {
		t.Fatal("erro ao medir o disco deveria recusar")
	}
}
