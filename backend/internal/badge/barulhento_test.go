package badge

import (
	"context"
	"testing"
)

func TestBarulhentoTiers(t *testing.T) {
	c := category(t, "barulhento")
	if c.Name != "Barulhento" || c.Unit != UnitSounds || c.Exclusive {
		t.Fatalf("category = %+v", c)
	}
	assertTiers(t, "barulhento", []Tier{
		{"Buzina", 25, RarityCommon},
		{"Fanfarrão", 250, RarityRare},
		{"Trio Elétrico", 1000, RarityEpic},
		{"Caixa de Som do Vizinho", 5000, RarityLegendary},
	})
}

func TestEvaluateBarulhentoUsesSoundsPlayed(t *testing.T) {
	badges, _ := Evaluate(Stats{CreatedAt: FounderCutoff, SoundsPlayed: 300}, nil, now)
	if b := find(t, badges, "barulhento"); b.Value != 300 || b.Tier != 2 || b.TierName != "Fanfarrão" {
		t.Fatalf("barulhento = %+v", b)
	}
}

func TestCountSoundsUnlocksBarulhento(t *testing.T) {
	s, st, pub, _, _ := newTestService()
	st.stats["ana"] = Stats{CreatedAt: FounderCutoff, SoundsPlayed: 25}
	st.counts["ana"] = map[string]int64{"barulhento": 24}
	s.Count(context.Background(), "ana", "barulhento", 1)
	if len(pub.events) != 1 || pub.events[0].Unlocks[0].Category != "barulhento" {
		t.Fatalf("events = %+v", pub.events)
	}
}

func TestBarulhentoDB(t *testing.T) {
	d := newTestDB(t)
	ana, _ := d.user()
	repo := BadgeRepository(d.db)
	if total, err := repo.AddCount(d.ctx, ana, "barulhento", 1); err != nil || total != 1 {
		t.Fatalf("AddCount = %d, %v", total, err)
	}
	if s, err := repo.Stats(d.ctx, ana); err != nil || s.SoundsPlayed != 1 {
		t.Fatalf("sounds = %d, %v", s.SoundsPlayed, err)
	}
}
