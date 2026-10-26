package proposal

import (
	"context"
	"errors"
	"testing"
)

type fakeBadges struct{ refreshed []string }

func (f *fakeBadges) Refresh(_ context.Context, userID string) {
	f.refreshed = append(f.refreshed, userID)
}

// Card novo reavalia o badge Contribuinte de quem criou na hora (o aviso de
// desbloqueio sai sem esperar a varredura dos online).
func TestCreateRefreshesAuthorBadges(t *testing.T) {
	s, _, _ := newTestService(nil)
	badges := &fakeBadges{}
	s.WithBadges(badges)
	ctx := context.Background()

	if _, err := s.Create(ctx, "u1", "Modo escuro melhor", "", nil); err != nil {
		t.Fatal(err)
	}
	if len(badges.refreshed) != 1 || badges.refreshed[0] != "u1" {
		t.Fatalf("refreshed = %v, want [u1]", badges.refreshed)
	}

	// Card recusado (título inválido) não mexe nos badges.
	if _, err := s.Create(ctx, "u1", "ab", "", nil); !errors.Is(err, ErrInvalidTitle) {
		t.Fatalf("err = %v", err)
	}
	if len(badges.refreshed) != 1 {
		t.Fatalf("refreshed after a failed create: %v", badges.refreshed)
	}
}

func TestCreateWithoutBadgesStillWorks(t *testing.T) {
	s, _, _ := newTestService(nil)
	if _, err := s.Create(context.Background(), "u1", "Modo escuro melhor", "", nil); err != nil {
		t.Fatal(err)
	}
}
