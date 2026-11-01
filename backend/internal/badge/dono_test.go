package badge

import "testing"

const donoMigration = "../../migrations/000111_badge_dono_membros.up.sql"

// members põe as pessoas no servidor (o dono também é membro, como no app).
func (d *testDB) members(serverID string, ids ...string) {
	d.t.Helper()
	for _, id := range ids {
		d.exec(`INSERT INTO server_members (server_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, serverID, id)
	}
}

// bot cria um usuário bot (como o Maestro), apagado no fim do teste.
func (d *testDB) bot() string {
	d.t.Helper()
	id, _ := d.user()
	d.exec(`UPDATE users SET is_bot = TRUE WHERE id = $1`, id)
	return id
}

func TestDonoBackfillMatchesCatalog(t *testing.T) {
	assertBackfillMatchesCatalog(t, "dono", donoMigration)
}

// Só conta servidor com pelo menos 3 membros além do dono (bots não contam).
func TestRepositoryDonoCountsServersWithThreeMembers(t *testing.T) {
	d := newTestDB(t)
	owner, _ := d.user()
	a, _ := d.user()
	b, _ := d.user()
	c, _ := d.user()
	maestro := d.bot()

	cheio, _ := d.server(owner)
	d.members(cheio, owner, a, b, c)
	comBot, _ := d.server(owner) // 2 pessoas + bot
	d.members(comBot, owner, a, b, maestro)
	vazio, _ := d.server(owner)
	d.members(vazio, owner)

	s, err := BadgeRepository(d.db).Stats(d.ctx, owner)
	if err != nil || s.OwnedServers != 1 {
		t.Fatalf("servers = %d, %v (want 1: só o com 3 membros)", s.OwnedServers, err)
	}
	// O terceiro membro chega: passa a contar na próxima avaliação.
	d.members(comBot, c)
	if s, _ = BadgeRepository(d.db).Stats(d.ctx, owner); s.OwnedServers != 2 {
		t.Fatalf("depois do 3º membro servers = %d, want 2", s.OwnedServers)
	}
}

// Retroativo: quem farmou servidores vazios cai; quem tem servidores de
// verdade mantém.
func TestDonoBackfillDemotes(t *testing.T) {
	d := newTestDB(t)
	farm, _ := d.user()
	turma, _ := d.user()
	a, _ := d.user()
	b, _ := d.user()
	c, _ := d.user()
	for i := 0; i < 5; i++ {
		srv, _ := d.server(farm)
		d.members(srv, farm)
	}
	srv, _ := d.server(farm)
	d.members(srv, farm, a, b, c)
	for i := 0; i < 3; i++ {
		srv, _ := d.server(turma)
		d.members(srv, turma, a, b, c)
	}
	for tier := 1; tier <= 3; tier++ {
		d.exec(`INSERT INTO user_badges (user_id, category, tier) VALUES ($1, 'dono', $2)`, farm, tier)
	}
	d.exec(`INSERT INTO user_badges (user_id, category, tier) VALUES ($1, 'dono', 1), ($1, 'dono', 2), ($1, 'voz', 1)`, turma)

	d.runBackfill(donoMigration)
	repo := BadgeRepository(d.db)
	for _, tc := range []struct {
		name  string
		id    string
		tiers int
	}{{"farm", farm, 1}, {"turma", turma, 2}} {
		unlocks, _ := repo.Unlocks(d.ctx, tc.id)
		if got := len(unlocks["dono"]); got != tc.tiers {
			t.Fatalf("%s dono tiers = %v, want %d", tc.name, unlocks["dono"], tc.tiers)
		}
	}
	if unlocks, _ := repo.Unlocks(d.ctx, turma); len(unlocks["voz"]) != 1 {
		t.Fatalf("outra categoria mexida: %v", unlocks)
	}
}
