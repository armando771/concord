package badge

import (
	"testing"
	"time"
)

const aniversarianteMigration = "../../migrations/000078_birthday_set_at.up.sql"

// Anti-trapaça: a data de aniversário precisa estar cadastrada há 30 dias.
// Mudar a data para hoje não dá o badge.
func TestEvaluateAniversarianteNeedsTheDateFor30Days(t *testing.T) {
	brt := Brasilia()
	day := time.Date(2026, 10, 25, 10, 0, 0, 0, brt)
	cases := []struct {
		name  string
		setAt time.Time
		want  int
	}{
		{"cadastrada há 30 dias", day.Add(-30 * 24 * time.Hour), 1},
		{"cadastrada há um ano", day.AddDate(-1, 0, 0), 1},
		{"cadastrada há 29 dias", day.Add(-29 * 24 * time.Hour), 0},
		{"trocada hoje para hoje", day.Add(-time.Hour), 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := Stats{CreatedAt: FounderCutoff, BirthdayDay: 25, BirthdayMonth: 10, BirthdaySetAt: tc.setAt}
			badges, _ := Evaluate(s, nil, day)
			if b := find(t, badges, "aniversariante"); b.Tier != tc.want {
				t.Fatalf("tier = %d, want %d", b.Tier, tc.want)
			}
		})
	}
}

// No banco: trocar dia/mês marca a hora da troca; mexer só no anúncio (ou só
// no ano) não; quem já tinha data ganha a criação da conta como data antiga.
func TestBirthdaySetAtDB(t *testing.T) {
	d := newTestDB(t)
	ana, _ := d.user()
	repo := BadgeRepository(d.db)
	setAt := func() time.Time {
		t.Helper()
		s, err := repo.Stats(d.ctx, ana)
		if err != nil {
			t.Fatal(err)
		}
		return s.BirthdaySetAt
	}
	old := time.Date(2025, 1, 1, 12, 0, 0, 0, time.UTC)
	d.exec(`UPDATE users SET created_at = $2 WHERE id = $1`, ana, old)

	// Cadastrar marca agora.
	d.exec(`UPDATE users SET birthday_day = 25, birthday_month = 10, birthday_year = 2000 WHERE id = $1`, ana)
	if at := setAt(); time.Since(at) > time.Minute {
		t.Fatalf("set_at after setting = %v, want now", at)
	}

	// Backfill: quem já tinha data fica com a criação da conta.
	d.exec(`UPDATE users SET birthday_set_at = NULL WHERE id = $1`, ana)
	d.runBackfill(aniversarianteMigration)
	if at := setAt(); !at.Equal(old) {
		t.Fatalf("backfill set_at = %v, want %v", at, old)
	}

	// Só o anúncio ou só o ano: não reseta.
	d.exec(`UPDATE users SET announce_birthday = false WHERE id = $1`, ana)
	// Como o user.SaveBirthday grava: todas as colunas, com o mesmo dia/mês.
	d.exec(`UPDATE users SET birthday_day = 25, birthday_month = 10, birthday_year = 2000, announce_birthday = true WHERE id = $1`, ana)
	d.exec(`UPDATE users SET announce_birthday = true, birthday_year = 2001 WHERE id = $1`, ana)
	if at := setAt(); !at.Equal(old) {
		t.Fatalf("set_at after toggling = %v, want unchanged %v", at, old)
	}

	// Trocar o dia reseta.
	d.exec(`UPDATE users SET birthday_day = 26 WHERE id = $1`, ana)
	if at := setAt(); time.Since(at) > time.Minute {
		t.Fatalf("set_at after changing the day = %v, want now", at)
	}
}
