package badge

import (
	"testing"
	"time"
)

func TestAniversarianteTier(t *testing.T) {
	c := category(t, "aniversariante")
	if c.Name != "Aniversariante" || c.Unit != UnitBirthday || c.Exclusive {
		t.Fatalf("category = %+v", c)
	}
	assertTiers(t, "aniversariante", []Tier{{"Aniversariante", 1, RarityCommon}})
}

func TestEvaluateAniversarianteOnTheDayInBrasilia(t *testing.T) {
	brt := Brasilia()
	cases := []struct {
		name       string
		day, month int64
		at         time.Time
		want       int
	}{
		{"no dia", 25, 10, time.Date(2026, 10, 25, 10, 0, 0, 0, brt), 1},
		{"23h de Brasília ainda é o dia (já é 26 em UTC)", 25, 10, time.Date(2026, 10, 25, 23, 0, 0, 0, brt), 1},
		{"dia seguinte", 25, 10, time.Date(2026, 10, 26, 0, 30, 0, 0, brt), 0},
		{"29/02 comemora em 28/02 no ano não bissexto", 29, 2, time.Date(2027, 2, 28, 12, 0, 0, 0, brt), 1},
		{"sem aniversário cadastrado", 0, 0, time.Date(2026, 10, 25, 10, 0, 0, 0, brt), 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := Stats{CreatedAt: FounderCutoff, BirthdayDay: tc.day, BirthdayMonth: tc.month}
			badges, _ := Evaluate(s, nil, tc.at)
			if got := tierOf(badges, "aniversariante"); got != tc.want {
				t.Fatalf("tier = %d, want %d", got, tc.want)
			}
		})
	}
}

// Ganho no dia, fica para sempre.
func TestEvaluateAniversarianteStaysAfterTheDay(t *testing.T) {
	stored := Unlocks{"aniversariante": {1: now.Add(-48 * time.Hour)}}
	badges, fresh := Evaluate(Stats{CreatedAt: FounderCutoff, BirthdayDay: 1, BirthdayMonth: 1}, stored, now)
	if b := find(t, badges, "aniversariante"); b.Tier != 1 {
		t.Fatalf("aniversariante = %+v", b)
	}
	if len(fresh) != 0 {
		for _, u := range fresh {
			if u.Category == "aniversariante" {
				t.Fatalf("unlocked again: %+v", u)
			}
		}
	}
}

// O aniversário só vale para o badge se a pessoa deixa anunciar (o dia do
// badge diria a data para todo mundo).
func TestAniversarianteDB(t *testing.T) {
	d := newTestDB(t)
	ana, _ := d.user()
	bia, _ := d.user()
	d.exec(`UPDATE users SET birthday_day = 25, birthday_month = 10, birthday_year = 2000 WHERE id = $1`, ana)
	d.exec(`UPDATE users SET birthday_day = 25, birthday_month = 10, birthday_year = 2000, announce_birthday = false WHERE id = $1`, bia)
	repo := BadgeRepository(d.db)
	if s, err := repo.Stats(d.ctx, ana); err != nil || s.BirthdayDay != 25 || s.BirthdayMonth != 10 {
		t.Fatalf("ana = %d/%d, %v", s.BirthdayDay, s.BirthdayMonth, err)
	}
	if s, err := repo.Stats(d.ctx, bia); err != nil || s.BirthdayDay != 0 || s.BirthdayMonth != 0 {
		t.Fatalf("bia (sem anúncio) = %d/%d, %v", s.BirthdayDay, s.BirthdayMonth, err)
	}
}
