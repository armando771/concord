package badge

import "testing"

const amigosMigration = "../../migrations/000112_badge_amigos_conta_real.up.sql"

// realAccount deixa a conta "real": e-mail confirmado e criada há 30 dias.
func (d *testDB) realAccount(id string) {
	d.t.Helper()
	d.exec(`UPDATE users SET email_verified_at = NOW() - INTERVAL '30 days', created_at = NOW() - INTERVAL '30 days' WHERE id = $1`, id)
}

func (d *testDB) friends(a, b, status string) {
	d.t.Helper()
	d.exec(`INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, $3)`, a, b, status)
	d.t.Cleanup(func() {
		d.db.Exec(d.ctx, `DELETE FROM friendships WHERE requester_id = $1 AND addressee_id = $2`, a, b)
	})
}

func TestAmigosBackfillMatchesCatalog(t *testing.T) {
	assertBackfillMatchesCatalog(t, "amigos", amigosMigration)
}

// Só conta amizade aceita com conta real: e-mail confirmado e não bot, sem
// prazo de idade. Quem confirma o e-mail depois passa a contar na próxima
// avaliação.
func TestRepositoryAmigosCountsOnlyRealAccounts(t *testing.T) {
	d := newTestDB(t)
	me, _ := d.user()
	ana, _ := d.user()  // real
	bia, _ := d.user()  // real, conta de 1 minuto
	caio, _ := d.user() // conta antiga sem e-mail confirmado
	dani, _ := d.user() // real, pedido pendente
	bot, _ := d.user()  // bot antigo com e-mail confirmado
	for _, id := range []string{ana, dani, bot} {
		d.realAccount(id)
	}
	d.exec(`UPDATE users SET is_bot = true WHERE id = $1`, bot)
	d.exec(`UPDATE users SET email_verified_at = NOW(), created_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, bia)
	d.exec(`UPDATE users SET created_at = NOW() - INTERVAL '30 days' WHERE id = $1`, caio)
	d.friends(me, ana, "accepted")
	d.friends(bia, me, "accepted")
	d.friends(me, caio, "accepted")
	d.friends(me, dani, "pending")
	d.friends(me, bot, "accepted")

	repo := BadgeRepository(d.db)
	s, err := repo.Stats(d.ctx, me)
	if err != nil || s.Friends != 2 {
		t.Fatalf("friends = %d, %v (want 2: ana e bia)", s.Friends, err)
	}
	d.exec(`UPDATE users SET email_verified_at = NOW() WHERE id = $1`, caio)
	if s, _ = repo.Stats(d.ctx, me); s.Friends != 3 {
		t.Fatalf("caio confirmou o e-mail: friends = %d, want 3", s.Friends)
	}
}

// Retroativo: quem farmou amizades com contas novas cai; quem tem amigos de
// verdade mantém.
func TestAmigosBackfillDemotes(t *testing.T) {
	d := newTestDB(t)
	farm, _ := d.user()
	turma, _ := d.user()
	for i := 0; i < 15; i++ {
		alt, _ := d.user() // conta nova sem e-mail confirmado
		d.friends(farm, alt, "accepted")
	}
	for i := 0; i < 5; i++ {
		amigo, _ := d.user()
		d.realAccount(amigo)
		d.friends(amigo, turma, "accepted")
	}
	d.exec(`INSERT INTO user_badges (user_id, category, tier) VALUES ($1, 'amigos', 1), ($1, 'amigos', 2), ($1, 'voz', 1)`, farm)
	d.exec(`INSERT INTO user_badges (user_id, category, tier) VALUES ($1, 'amigos', 1)`, turma)

	d.runBackfill(amigosMigration)
	repo := BadgeRepository(d.db)
	for _, tc := range []struct {
		name  string
		id    string
		tiers int
	}{{"farm", farm, 0}, {"turma", turma, 1}} {
		unlocks, _ := repo.Unlocks(d.ctx, tc.id)
		if got := len(unlocks["amigos"]); got != tc.tiers {
			t.Fatalf("%s amigos tiers = %v, want %d", tc.name, unlocks["amigos"], tc.tiers)
		}
	}
	if unlocks, _ := repo.Unlocks(d.ctx, farm); len(unlocks["voz"]) != 1 {
		t.Fatalf("outra categoria mexida: %v", unlocks)
	}
}
