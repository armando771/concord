package badge

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

const votanteMigration = "../../migrations/000075_badge_votante.up.sql"

func TestVotanteTiers(t *testing.T) {
	c := category(t, "votante")
	if c.Name != "Votante" || c.Unit != UnitVotes || c.Exclusive {
		t.Fatalf("category = %+v", c)
	}
	assertTiers(t, "votante", []Tier{
		{"Eleitor", 1, RarityCommon},
		{"Cidadão", 10, RarityCommon},
		{"Fiscal de Urna", 30, RarityRare},
		{"Mesário", 75, RarityEpic},
		{"Voto de Minerva", 150, RarityLegendary},
	})
}

func TestEvaluateVotanteUsesVotes(t *testing.T) {
	badges, _ := Evaluate(Stats{CreatedAt: FounderCutoff, Votes: 12}, nil, now)
	if b := find(t, badges, "votante"); b.Value != 12 || b.Tier != 2 || b.TierName != "Cidadão" {
		t.Fatalf("votante = %+v", b)
	}
}

func TestVotanteBackfillMatchesCatalog(t *testing.T) {
	assertBackfillMatchesCatalog(t, "votante", votanteMigration)
}

// Contagem e backfill num Postgres de verdade: trocar o voto não conta de novo.
func TestVotanteDB(t *testing.T) {
	d := newTestDB(t)
	ana, _ := d.user()
	bia, _ := d.user()
	base := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)
	for i := 0; i < 2; i++ {
		id := uuid.NewString()
		d.exec(`INSERT INTO proposals (id, author_id, title, created_at, voting_ends_at) VALUES ($1, $2, 'Ideia', $3, $3)`, id, bia, base)
		d.exec(`INSERT INTO proposal_votes (proposal_id, user_id, approve, created_at) VALUES ($1, $2, true, $3)`, id, ana, base.Add(time.Duration(i+1)*time.Hour))
	}
	d.exec(`UPDATE proposal_votes SET approve = false WHERE user_id = $1`, ana) // trocou o voto

	repo := BadgeRepository(d.db)
	if s, err := repo.Stats(d.ctx, ana); err != nil || s.Votes != 2 {
		t.Fatalf("votes = %d, %v (want 2)", s.Votes, err)
	}
	d.runBackfill(votanteMigration)
	unlocks, _ := repo.Unlocks(d.ctx, ana)
	if got := unlocks["votante"]; len(got) != 1 || !got[1].Equal(base.Add(time.Hour)) {
		t.Fatalf("backfill = %v", got)
	}
}
