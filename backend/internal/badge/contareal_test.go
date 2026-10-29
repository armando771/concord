package badge

import (
	"testing"
	"time"
)

const amigosRestoreMigration = "../../migrations/000166_badge_amigos_devolver.up.sql"

// Conta real é só quem não é bot e confirmou o e-mail, sem prazo de idade.
// A função SQL do nível do servidor (server_level_real), a consulta do Festeiro
// (RealAccounts) e a do Amigos (Stats) têm que dar a mesma resposta.
func TestContaRealEhEmailConfirmadoNoGoENoSQL(t *testing.T) {
	d := newTestDB(t)
	cases := []struct {
		name     string
		age      string
		verified bool
		bot      bool
		want     bool
	}{
		{"recém-criada com e-mail confirmado", "1 minute", true, false, true},
		{"conta antiga com e-mail confirmado", "30 days", true, false, true},
		{"recém-criada sem e-mail", "1 minute", false, false, false},
		{"antiga sem e-mail", "30 days", false, false, false},
		{"bot com e-mail confirmado", "30 days", true, true, false},
	}
	repo := BadgeRepository(d.db)
	for _, tc := range cases {
		id, _ := d.user()
		d.exec(`UPDATE users SET created_at = NOW() - $2::interval, is_bot = $3,
			email_verified_at = CASE WHEN $4 THEN NOW() ELSE NULL END WHERE id = $1`, id, tc.age, tc.bot, tc.verified)

		var sql bool
		if err := d.db.QueryRow(d.ctx, `SELECT server_level_real($1)`, id).Scan(&sql); err != nil {
			t.Fatal(err)
		}
		if sql != tc.want {
			t.Errorf("%s: server_level_real = %v, quer %v", tc.name, sql, tc.want)
		}

		real, err := repo.RealAccounts(d.ctx, []string{id})
		if err != nil {
			t.Fatal(err)
		}
		if real[id] != tc.want {
			t.Errorf("%s: RealAccounts = %v, quer %v", tc.name, real[id], tc.want)
		}

		dono, _ := d.user()
		d.friends(dono, id, "accepted")
		s, err := repo.Stats(d.ctx, dono)
		if err != nil {
			t.Fatal(err)
		}
		if got := s.Friends == 1; got != tc.want {
			t.Errorf("%s: amigo conta = %v, quer %v", tc.name, got, tc.want)
		}
	}
}

// O Amigos devolvido: tiers do valor novo (conta real de 24 h), sem tocar em
// outras categorias, sem apagar o que já existe e com unlocked_at = agora.
func TestAmigosDevolverRegravaTiersSemApagarNada(t *testing.T) {
	d := newTestDB(t)
	farm, _ := d.user()   // 5 amigos de 25 h: direito ao tier 1
	turma, _ := d.user()  // 4 amigos reais e 1 de 23 h: sem direito
	antigo, _ := d.user() // já tem o tier 1 gravado: mantém a data
	for _, dono := range []string{farm, antigo} {
		for i := 0; i < 5; i++ {
			amigo, _ := d.user()
			d.exec(`UPDATE users SET email_verified_at = NOW(), created_at = NOW() - INTERVAL '25 hours' WHERE id = $1`, amigo)
			d.friends(amigo, dono, "accepted")
		}
	}
	for i := 0; i < 5; i++ {
		amigo, _ := d.user()
		age := "25 hours"
		if i == 0 {
			age = "23 hours"
		}
		d.exec(`UPDATE users SET email_verified_at = NOW(), created_at = NOW() - $2::interval WHERE id = $1`, amigo, age)
		d.friends(turma, amigo, "accepted")
	}
	d.exec(`INSERT INTO user_badges (user_id, category, tier, unlocked_at) VALUES ($1, 'amigos', 1, '2026-10-20T12:00:00Z'), ($1, 'voz', 1, NOW())`, antigo)

	d.runBackfill(amigosRestoreMigration)
	d.runBackfill(amigosRestoreMigration) // idempotente

	repo := BadgeRepository(d.db)
	if u, _ := repo.Unlocks(d.ctx, farm); len(u["amigos"]) != 1 {
		t.Fatalf("farm amigos = %v, quer o tier 1", u["amigos"])
	} else if at := u["amigos"][1]; time.Since(at) > time.Minute {
		t.Errorf("unlocked_at = %v, quer agora", at)
	}
	if u, _ := repo.Unlocks(d.ctx, turma); len(u["amigos"]) != 0 {
		t.Fatalf("turma amigos = %v, quer nenhum (4 amigos reais)", u["amigos"])
	}
	u, _ := repo.Unlocks(d.ctx, antigo)
	if at := u["amigos"][1]; at.Year() != 2026 || at.Month() != 10 || at.Day() != 20 {
		t.Errorf("tier já gravado perdeu a data: %v", at)
	}
	if len(u["voz"]) != 1 {
		t.Errorf("outra categoria mexida: %v", u)
	}
}

func TestAmigosDevolverMatchesCatalog(t *testing.T) {
	assertBackfillMatchesCatalog(t, "amigos", amigosRestoreMigration)
}
