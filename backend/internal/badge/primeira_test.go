package badge

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
)

const primeiraMigration = "../../migrations/000076_badge_primeira.up.sql"

func TestPrimeiraTiers(t *testing.T) {
	c := category(t, "primeira")
	if c.Name != "Primeira mensagem" || c.Unit != UnitFirsts || !c.Exclusive {
		t.Fatalf("category = %+v", c)
	}
	assertTiers(t, "primeira", []Tier{
		{"Quebra-gelo", 1, RarityRare},
		{"Desbravador", 3, RarityEpic},
		{"Big Bang", 10, RarityLegendary},
	})
}

// Exclusivo: quem não mandou a primeira mensagem de nenhum servidor nem vê.
func TestEvaluatePrimeiraOnlyForWhoWasFirst(t *testing.T) {
	badges, _ := Evaluate(Stats{CreatedAt: FounderCutoff}, nil, now)
	for _, b := range badges {
		if b.Category == "primeira" {
			t.Fatalf("primeira shown without a first message: %+v", b)
		}
	}
	badges, _ = Evaluate(Stats{CreatedAt: FounderCutoff, FirstMessages: 3}, nil, now)
	if b := find(t, badges, "primeira"); b.Tier != 2 || b.TierName != "Desbravador" {
		t.Fatalf("primeira = %+v", b)
	}
}

func TestPrimeiraBackfillMatchesCatalog(t *testing.T) {
	assertBackfillMatchesCatalog(t, "primeira", primeiraMigration)
}

// Trigger, corrida e backfill num Postgres de verdade.
func TestPrimeiraDB(t *testing.T) {
	d := newTestDB(t)
	ana, _ := d.user()
	bia, _ := d.user()
	repo := BadgeRepository(d.db)
	t.Cleanup(func() {
		d.db.Exec(d.ctx, `DELETE FROM server_first_messages WHERE user_id IN ($1, $2)`, ana, bia)
	})
	msg := func(author, channelID string, at time.Time, kind any) string {
		id := uuid.NewString()
		d.exec(`INSERT INTO messages (id, author_id, channel_id, content, system_kind, created_at) VALUES ($1, $2, $3, 'oi', $4, $5)`, id, author, channelID, kind, at)
		return id
	}
	firsts := func(id string) int64 {
		t.Helper()
		s, err := repo.Stats(d.ctx, id)
		if err != nil {
			t.Fatal(err)
		}
		return s.FirstMessages
	}

	// Servidor novo: a mensagem do sistema (boas-vindas) não conta; a da Bia,
	// sim; a da Ana depois, não.
	_, ch1 := d.server(ana)
	base := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)
	msg(ana, ch1, base, "welcome")
	msg(bia, ch1, base.Add(time.Minute), nil)
	msg(ana, ch1, base.Add(2*time.Minute), nil)
	if firsts(bia) != 1 || firsts(ana) != 0 {
		t.Fatalf("firsts bia=%d ana=%d, want 1/0", firsts(bia), firsts(ana))
	}

	// Corrida: dez mensagens ao mesmo tempo num servidor novo têm um só dono.
	_, ch2 := d.server(ana)
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		author := ana
		if i%2 == 1 {
			author = bia
		}
		wg.Add(1)
		go func() {
			defer wg.Done()
			d.db.Exec(context.Background(), `INSERT INTO messages (id, author_id, channel_id, content) VALUES (gen_random_uuid(), $1, $2, 'oi')`, author, ch2)
		}()
	}
	wg.Wait()
	var owners int
	if err := d.db.QueryRow(d.ctx, `SELECT COUNT(*) FROM server_first_messages f JOIN channels c ON c.server_id = f.server_id WHERE c.id = $1`, ch2).Scan(&owners); err != nil || owners != 1 {
		t.Fatalf("owners = %d, %v", owners, err)
	}
	if firsts(ana)+firsts(bia) != 2 {
		t.Fatalf("firsts ana=%d bia=%d, want 2 in total (ch1 e ch2)", firsts(ana), firsts(bia))
	}

	// Backfill: servidor antigo cuja primeira mensagem foi apagada fica com a
	// mais antiga que existe; o tier entra com a data dela.
	// (servidor de antes do trigger: sem dono gravado).
	sv3, ch3 := d.server(bia)
	gone := msg(bia, ch3, base.Add(-time.Hour), nil)
	msg(ana, ch3, base.Add(-30*time.Minute), nil)
	d.exec(`DELETE FROM server_first_messages WHERE server_id = $1`, sv3)
	d.exec(`DELETE FROM messages WHERE id = $1`, gone)
	before := firsts(ana)
	d.runBackfill(primeiraMigration)
	if firsts(ana) != before+1 {
		t.Fatalf("backfill: ana firsts %d -> %d, want +1", before, firsts(ana))
	}
	unlocks, _ := repo.Unlocks(d.ctx, ana)
	if len(unlocks["primeira"]) == 0 {
		t.Fatalf("backfill unlocks = %v", unlocks)
	}
}
