package badge

import (
	"context"
	"testing"
	"time"
)

const djMigration = "../../migrations/000070_badge_dj.up.sql"

func TestDJTiers(t *testing.T) {
	c := category(t, "dj")
	if c.Name != "DJ" || c.Unit != UnitSongs || c.Exclusive {
		t.Fatalf("category = %+v", c)
	}
	assertTiers(t, "dj", []Tier{
		{"Pede Música", 10, RarityCommon},
		{"Dono da Playlist", 50, RarityCommon},
		{"DJ de Churrasco", 200, RarityRare},
		{"DJ Residente", 1000, RarityEpic},
		{"Lenda das Pick-ups", 5000, RarityLegendary},
	})
}

func TestEvaluateDJUsesSongsQueued(t *testing.T) {
	badges, _ := Evaluate(Stats{CreatedAt: FounderCutoff, SongsQueued: 60}, nil, now)
	b := find(t, badges, "dj")
	if b.Value != 60 || b.Tier != 2 || b.TierName != "Dono da Playlist" {
		t.Fatalf("dj = %+v", b)
	}
}

// Contar uma música só reavalia os badges quando cruza um limite: a fila do
// Maestro não vira três consultas por pedido.
func TestCountRefreshesOnlyWhenCrossingATier(t *testing.T) {
	s, st, pub, _, _ := newTestService()
	st.stats["ana"] = Stats{CreatedAt: FounderCutoff, SongsQueued: 9}
	st.counts["ana"] = map[string]int64{"dj": 8}

	s.Count(context.Background(), "ana", "dj", 1) // 9: nada
	if len(st.synced) != 0 {
		t.Fatalf("synced = %v, want nothing below the first tier", st.synced)
	}
	st.stats["ana"] = Stats{CreatedAt: FounderCutoff, SongsQueued: 12}
	s.Count(context.Background(), "ana", "dj", 3) // 9 -> 12 cruza o 10
	if len(st.synced) != 1 || len(pub.events) != 1 || pub.events[0].Unlocks[0].Category != "dj" {
		t.Fatalf("synced = %v events = %+v", st.synced, pub.events)
	}
	if got := st.counts["ana"]["dj"]; got != 12 {
		t.Fatalf("count = %d", got)
	}
}

func TestCountIgnoresUnknownCategoriesAndZero(t *testing.T) {
	s, st, _, _, _ := newTestService()
	s.Count(context.Background(), "ana", "mensagens", 1)
	s.Count(context.Background(), "ana", "dj", 0)
	if len(st.counts) != 0 || len(st.synced) != 0 {
		t.Fatalf("counts = %v synced = %v", st.counts, st.synced)
	}
}

func TestCrossedTier(t *testing.T) {
	cases := []struct {
		before, after int64
		want          bool
	}{
		{0, 9, false}, {9, 10, true}, {10, 11, false}, {40, 60, true}, {0, 5000, true}, {5000, 6000, false},
	}
	for _, tc := range cases {
		if got := crossedTier(category(t, "dj"), tc.before, tc.after); got != tc.want {
			t.Errorf("crossedTier(%d, %d) = %v, want %v", tc.before, tc.after, got, tc.want)
		}
	}
}

func TestDJBackfillMatchesCatalog(t *testing.T) {
	assertBackfillMatchesCatalog(t, "dj", djMigration)
}

// Contador e backfill pelos avisos do Maestro num Postgres de verdade.
func TestDJDB(t *testing.T) {
	d := newTestDB(t)
	ana, anaName := d.user()
	bia, _ := d.user()
	conv := d.conversation(ana, bia)
	base := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)
	music := func(n int, content string) {
		d.exec(`INSERT INTO messages (id, author_id, conversation_id, content, system_kind, created_at) VALUES (gen_random_uuid(), $1, $2, $3, 'music', $4)`,
			bia, conv, content, base.Add(time.Duration(n)*time.Hour))
	}
	// 1 música, depois uma playlist de 12 (cruza o 10 no 2º aviso).
	music(0, "🎵 @"+anaName+" adicionou **Bohemian** (5:55) · 🔊 Sala · tocando agora")
	music(1, "🎵 @"+anaName+" adicionou a playlist **Rock** (12 músicas, ~50 min) · 🔊 Sala")
	music(2, "⚠️ **X** (pedido de @"+anaName+") não carregou e foi pulada · 🔊 Sala")

	d.runBackfill(djMigration)
	d.runBackfill(djMigration) // de novo não soma duas vezes
	repo := BadgeRepository(d.db)
	s, err := repo.Stats(d.ctx, ana)
	if err != nil || s.SongsQueued != 13 {
		t.Fatalf("ana songs = %d, %v (want 13)", s.SongsQueued, err)
	}
	unlocks, _ := repo.Unlocks(d.ctx, ana)
	if got := unlocks["dj"]; len(got) != 1 || !got[1].Equal(base.Add(time.Hour)) {
		t.Fatalf("ana dj backfill = %v", got)
	}

	// A partir do deploy o backend soma.
	total, err := repo.AddCount(d.ctx, bia, "dj", 3)
	if err != nil || total != 3 {
		t.Fatalf("AddCount = %d, %v", total, err)
	}
	if total, _ = repo.AddCount(d.ctx, bia, "dj", 2); total != 5 {
		t.Fatalf("AddCount again = %d", total)
	}
	if _, err := repo.AddCount(d.ctx, bia, "mensagens", 1); err == nil {
		t.Fatal("AddCount accepted a category without counter")
	}
}
