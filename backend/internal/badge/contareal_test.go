package badge

import (
	"fmt"
	"os"
	"regexp"
	"testing"
	"time"
)

const (
	contaRealFuncMigration     = "../../migrations/000165_conta_real_24h.up.sql"
	amigosRestoreMigration     = "../../migrations/000166_badge_amigos_devolver.up.sql"
	contaRealIntervalRegexpSrc = `INTERVAL '(\d+) hours'`
)

// A função SQL do nível do servidor e as consultas do Go têm que usar o mesmo
// prazo de conta real: este teste trava a migration na constante.
func TestContaRealPrazoIgualNoGoENoSQL(t *testing.T) {
	want := fmt.Sprint(ContaRealHoras)
	for _, path := range []string{contaRealFuncMigration, amigosRestoreMigration} {
		raw, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		m := regexp.MustCompile(contaRealIntervalRegexpSrc).FindAllStringSubmatch(string(raw), -1)
		if len(m) == 0 {
			t.Fatalf("%s: prazo em horas não encontrado", path)
		}
		for _, hit := range m {
			if hit[1] != want {
				t.Errorf("%s: prazo = %s h, ContaRealHoras = %s", path, hit[1], want)
			}
		}
	}
}

// server_level_real: e-mail confirmado, não bot e 24 h de conta (23 h não, 25 h sim).
func TestServerLevelRealUsaPrazoDe24Horas(t *testing.T) {
	d := newTestDB(t)
	cases := []struct {
		name     string
		age      string
		verified bool
		bot      bool
		want     bool
	}{
		{"23 horas", "23 hours", true, false, false},
		{"25 horas", "25 hours", true, false, true},
		{"sem e-mail confirmado", "30 days", false, false, false},
		{"bot", "30 days", true, true, false},
	}
	for _, tc := range cases {
		id, _ := d.user()
		d.exec(`UPDATE users SET created_at = NOW() - $2::interval, is_bot = $3,
			email_verified_at = CASE WHEN $4 THEN NOW() ELSE NULL END WHERE id = $1`, id, tc.age, tc.bot, tc.verified)
		var got bool
		if err := d.db.QueryRow(d.ctx, `SELECT server_level_real($1)`, id).Scan(&got); err != nil {
			t.Fatal(err)
		}
		if got != tc.want {
			t.Errorf("%s: server_level_real = %v, quer %v", tc.name, got, tc.want)
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
