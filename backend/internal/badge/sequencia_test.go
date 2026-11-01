package badge

import (
	"context"
	"testing"
	"time"
)

const sequenciaMigration = "../../migrations/000073_badge_sequencia.up.sql"

func TestSequenciaTiers(t *testing.T) {
	c := category(t, "sequencia")
	if c.Name != "Sequência" || c.Unit != UnitDays || c.Exclusive {
		t.Fatalf("category = %+v", c)
	}
	assertTiers(t, "sequencia", []Tier{
		{"Faísca", 3, RarityCommon},
		{"Foguinho", 7, RarityCommon},
		{"Fogueira", 30, RarityRare},
		{"Incêndio", 100, RarityEpic},
		{"Chama Eterna", 365, RarityLegendary},
	})
}

// O tier vem da maior sequência já feita: perder a sequência não derruba.
func TestEvaluateSequenciaUsesLongestStreak(t *testing.T) {
	badges, _ := Evaluate(Stats{CreatedAt: FounderCutoff, StreakDays: 2, LongestStreakDays: 8}, nil, now)
	if b := find(t, badges, "sequencia"); b.Value != 8 || b.Tier != 2 || b.TierName != "Foguinho" {
		t.Fatalf("sequencia = %+v", b)
	}
}

func TestSequenciaBackfillMatchesCatalog(t *testing.T) {
	assertBackfillMatchesCatalog(t, "sequencia", sequenciaMigration)
}

func TestActiveDaysOncePerUserPerDay(t *testing.T) {
	var a activeDays
	if got := a.fresh("2026-10-25", []string{"ana", "bia"}); len(got) != 2 {
		t.Fatalf("first = %v", got)
	}
	if got := a.fresh("2026-10-25", []string{"ana", "caio"}); len(got) != 1 || got[0] != "caio" {
		t.Fatalf("same day = %v, want only caio", got)
	}
	a.forget([]string{"caio"})
	if got := a.fresh("2026-10-25", []string{"caio"}); len(got) != 1 {
		t.Fatalf("after forget = %v", got)
	}
	if got := a.fresh("2026-10-26", []string{"ana"}); len(got) != 1 {
		t.Fatalf("next day = %v", got)
	}
}

// O tick grava o dia de uso de quem está online uma vez por dia (Brasília) e
// reavalia essas pessoas.
func TestTickRecordsActiveDayOncePerDay(t *testing.T) {
	s, st, _, _, online := newTestService()
	st.stats["ana"] = Stats{CreatedAt: FounderCutoff}
	online.ids = []string{"ana"}

	at := t0
	for i := 0; i < 2*flushEvery; i++ {
		at = at.Add(tickInterval)
		s.tick(context.Background(), at)
	}
	if len(st.activeDays) != 1 || st.activeDays[0] != "ana@"+at.In(s.tracker.loc).Format(time.DateOnly) {
		t.Fatalf("active days = %v, want ana once", st.activeDays)
	}
	if len(st.synced) == 0 || st.synced[0] != "ana" {
		t.Fatalf("synced = %v, want ana right after the day", st.synced)
	}

	// Gravação falhou: tenta de novo no próximo flush.
	st.activeDays = nil
	st.failDays = true
	s.tick(context.Background(), at.Add(24*time.Hour))
	for i := 0; i < flushEvery; i++ {
		at = at.Add(tickInterval)
		s.tick(context.Background(), at.Add(24*time.Hour))
	}
	st.failDays = false
	for i := 0; i < flushEvery; i++ {
		at = at.Add(tickInterval)
		s.tick(context.Background(), at.Add(24*time.Hour))
	}
	if len(st.activeDays) != 1 {
		t.Fatalf("after failure = %v, want one retry", st.activeDays)
	}
}

// Backfill pelo histórico e a gravação diária num Postgres de verdade.
func TestSequenciaDB(t *testing.T) {
	d := newTestDB(t)
	ana, _ := d.user()
	bia, _ := d.user()
	conv := d.conversation(ana, bia)
	brt := Brasilia()
	day := func(n int) time.Time { return time.Date(2026, 9, 1+n, 12, 0, 0, 0, brt) }
	for _, n := range []int{0, 1, 2, 4, 5} { // 3 seguidos, buraco, 2 seguidos
		d.exec(`INSERT INTO messages (id, author_id, conversation_id, content, created_at) VALUES (gen_random_uuid(), $1, $2, 'oi', $3)`, ana, conv, day(n))
	}
	d.exec(`INSERT INTO messages (id, author_id, conversation_id, content, created_at) VALUES (gen_random_uuid(), $1, $2, 'oi', $3)`, ana, conv, day(5).Add(time.Hour)) // mesmo dia

	d.runBackfill(sequenciaMigration)
	repo := BadgeRepository(d.db)
	s, err := repo.Stats(d.ctx, ana)
	if err != nil || s.LongestStreakDays != 3 || s.StreakDays != 2 {
		t.Fatalf("backfill: streak %d longest %d, %v (want 2 and 3)", s.StreakDays, s.LongestStreakDays, err)
	}
	unlocks, _ := repo.Unlocks(d.ctx, ana)
	wantAt := time.Date(2026, 9, 3, 0, 0, 0, 0, brt)
	if got := unlocks["sequencia"]; len(got) != 1 || !got[1].Equal(wantAt) {
		t.Fatalf("backfill unlocks = %v, want tier 1 at %v", got, wantAt)
	}

	record := func(n int) Stats {
		t.Helper()
		if err := repo.RecordActiveDay(d.ctx, []string{ana, bia, "00000000-0000-0000-0000-000000000000"}, day(n).Format(time.DateOnly)); err != nil {
			t.Fatal(err)
		}
		s, err := repo.Stats(d.ctx, ana)
		if err != nil {
			t.Fatal(err)
		}
		return s
	}
	if s = record(6); s.StreakDays != 3 || s.LongestStreakDays != 3 {
		t.Fatalf("day 6: %d/%d, want 3/3", s.StreakDays, s.LongestStreakDays)
	}
	if s = record(7); s.StreakDays != 4 || s.LongestStreakDays != 4 {
		t.Fatalf("day 7: %d/%d, want 4/4", s.StreakDays, s.LongestStreakDays)
	}
	if s = record(7); s.StreakDays != 4 {
		t.Fatalf("same day twice: %d, want 4", s.StreakDays)
	}
	if s = record(9); s.StreakDays != 1 || s.LongestStreakDays != 4 {
		t.Fatalf("after a gap: %d/%d, want 1/4", s.StreakDays, s.LongestStreakDays)
	}
	if b, _ := repo.Stats(d.ctx, bia); b.StreakDays != 1 {
		t.Fatalf("bia (sem histórico) = %d, want 1", b.StreakDays)
	}
}
