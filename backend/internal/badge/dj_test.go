package badge

import (
	"context"
	"testing"
	"time"
)

const djMigration = "../../migrations/000110_badge_dj_tocadas.up.sql"

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

func TestEvaluateDJUsesSongsPlayed(t *testing.T) {
	badges, _ := Evaluate(Stats{CreatedAt: FounderCutoff, SongsPlayed: 60}, nil, now)
	b := find(t, badges, "dj")
	if b.Value != 60 || b.Tier != 2 || b.TierName != "Dono da Playlist" {
		t.Fatalf("dj = %+v", b)
	}
}

// Contar uma música só reavalia os badges quando cruza um limite: a fila do
// Maestro não vira três consultas por pedido.
func TestCountRefreshesOnlyWhenCrossingATier(t *testing.T) {
	s, st, pub, _, _ := newTestService()
	st.stats["ana"] = Stats{CreatedAt: FounderCutoff, SongsPlayed: 9}
	st.counts["ana"] = map[string]int64{"dj": 8}

	s.Count(context.Background(), "ana", "dj", 1) // 9: nada
	if len(st.synced) != 0 {
		t.Fatalf("synced = %v, want nothing below the first tier", st.synced)
	}
	st.stats["ana"] = Stats{CreatedAt: FounderCutoff, SongsPlayed: 12}
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

// Retroativo pelos avisos do Maestro num Postgres de verdade: cada aviso vale
// 1 (música ou playlist), o contador nunca sobe e quem farmou com playlist
// perde os tiers a mais; quem não farmou mantém.
func TestDJDB(t *testing.T) {
	d := newTestDB(t)
	ana, anaName := d.user()
	bia, biaName := d.user()
	caio, _ := d.user()
	conv := d.conversation(ana, bia)
	base := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)
	music := func(n int, content string) {
		d.exec(`INSERT INTO messages (id, author_id, conversation_id, content, system_kind, created_at) VALUES (gen_random_uuid(), $1, $2, $3, 'music', $4)`,
			bia, conv, content, base.Add(time.Duration(n)*time.Minute))
	}
	// ana: uma playlist de 5000 e 11 músicas avulsas = 12 avisos.
	music(0, "🎵 @"+anaName+" adicionou a playlist **Farm** (5000 músicas, ~300h 0min) · 🔊 Sala")
	for i := 1; i <= 11; i++ {
		music(i, "🎵 @"+anaName+" adicionou **Bohemian** (5:55) · 🔊 Sala · tocando agora")
	}
	music(12, "⚠️ **X** (pedido de @"+anaName+") não carregou e foi pulada · 🔊 Sala")
	// bia: 20 avisos, mas o contador tinha 15 (não sobe).
	for i := 0; i < 20; i++ {
		music(20+i, "🎵 @"+biaName+" adicionou **Song** (3:00) · 🔊 Sala · posição 2 · toca em ~3 min")
	}
	d.exec(`INSERT INTO user_badge_stats (user_id, songs_played) VALUES ($1, 5011), ($2, 15)`, ana, bia)
	for tier := 1; tier <= 5; tier++ {
		d.exec(`INSERT INTO user_badges (user_id, category, tier) VALUES ($1, 'dj', $2)`, ana, tier)
	}
	d.exec(`INSERT INTO user_badges (user_id, category, tier) VALUES ($1, 'dj', 1), ($1, 'voz', 3)`, bia)
	// caio: tier gravado sem contador nenhum.
	d.exec(`INSERT INTO user_badges (user_id, category, tier) VALUES ($1, 'dj', 1)`, caio)

	d.runBackfill(djMigration)
	d.runBackfill(djMigration) // de novo não muda nada
	repo := BadgeRepository(d.db)
	for _, tc := range []struct {
		name  string
		id    string
		songs int64
		tiers int
	}{{"ana", ana, 12, 1}, {"bia", bia, 15, 1}, {"caio", caio, 0, 0}} {
		s, err := repo.Stats(d.ctx, tc.id)
		if err != nil || s.SongsPlayed != tc.songs {
			t.Fatalf("%s songs = %d, %v (want %d)", tc.name, s.SongsPlayed, err, tc.songs)
		}
		unlocks, _ := repo.Unlocks(d.ctx, tc.id)
		if got := len(unlocks["dj"]); got != tc.tiers {
			t.Fatalf("%s dj tiers = %v, want %d", tc.name, unlocks["dj"], tc.tiers)
		}
	}
	if unlocks, _ := repo.Unlocks(d.ctx, bia); len(unlocks["voz"]) != 1 {
		t.Fatalf("outra categoria mexida: %v", unlocks)
	}

	// A partir do deploy o backend soma cada música que tocou.
	total, err := repo.AddCount(d.ctx, caio, "dj", 1)
	if err != nil || total != 1 {
		t.Fatalf("AddCount = %d, %v", total, err)
	}
	if total, _ = repo.AddCount(d.ctx, caio, "dj", 1); total != 2 {
		t.Fatalf("AddCount again = %d", total)
	}
	if _, err := repo.AddCount(d.ctx, bia, "mensagens", 1); err == nil {
		t.Fatal("AddCount accepted a category without counter")
	}
}
