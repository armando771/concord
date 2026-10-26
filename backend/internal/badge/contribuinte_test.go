package badge

import (
	"context"
	"fmt"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"gin-quickstart/backend/internal/database"

	"github.com/google/uuid"
)

const contribuinteMigration = "../../migrations/000058_badge_contribuinte.up.sql"

func contribuinte(t *testing.T) Category {
	t.Helper()
	for _, c := range Catalog {
		if c.Key == "contribuinte" {
			return c
		}
	}
	t.Fatal("contribuinte missing from the catalog")
	return Category{}
}

func TestContribuinteTiers(t *testing.T) {
	c := contribuinte(t)
	if c.Name != "Contribuinte" || c.Unit != UnitProposals || c.Exclusive {
		t.Fatalf("category = %+v", c)
	}
	want := []Tier{
		{"Ideia", 1, RarityCommon},
		{"Colaborador", 5, RarityRare},
		{"Inovador", 15, RarityEpic},
		{"Visionário", 40, RarityEpic},
		{"Arquiteto", 100, RarityLegendary},
	}
	if len(c.Tiers) != len(want) {
		t.Fatalf("tiers = %+v", c.Tiers)
	}
	for i, w := range want {
		if c.Tiers[i] != w {
			t.Errorf("tier %d = %+v, want %+v", i+1, c.Tiers[i], w)
		}
	}
}

func TestContribuinteTierForCount(t *testing.T) {
	c := contribuinte(t)
	cases := []struct {
		cards int64
		want  int
	}{
		{0, 0}, {1, 1}, {4, 1}, {5, 2}, {14, 2}, {15, 3}, {39, 3}, {40, 4}, {99, 4}, {100, 5}, {500, 5},
	}
	for _, tc := range cases {
		if got := tierFor(c, tc.cards); got != tc.want {
			t.Errorf("tierFor(%d cards) = %d, want %d", tc.cards, got, tc.want)
		}
	}
}

func TestEvaluateContribuinteUsesProposalCount(t *testing.T) {
	badges, fresh := Evaluate(Stats{CreatedAt: FounderCutoff, Proposals: 7}, nil, now)
	b := find(t, badges, "contribuinte")
	if b.Value != 7 || b.Tier != 2 || b.TierName != "Colaborador" || b.Rarity != RarityRare {
		t.Fatalf("contribuinte = %+v", b)
	}
	if b.NextTierName != "Inovador" || b.NextThreshold == nil || *b.NextThreshold != 15 {
		t.Fatalf("next = %q %v", b.NextTierName, b.NextThreshold)
	}
	// 7 de 5→15: 20%.
	if b.Progress < 0.199 || b.Progress > 0.201 {
		t.Fatalf("progress = %v, want 0.2", b.Progress)
	}
	var got []int
	for _, u := range fresh {
		if u.Category == "contribuinte" {
			got = append(got, u.Tier)
		}
	}
	if len(got) != 2 || got[0] != 1 || got[1] != 2 {
		t.Fatalf("fresh contribuinte tiers = %v, want [1 2]", got)
	}
}

func TestEvaluateContribuinteKeepsTierWhenCardIsDeleted(t *testing.T) {
	// O card apagado sai da contagem, mas o tier já conquistado fica.
	stored := Unlocks{"contribuinte": {1: now.Add(-time.Hour)}}
	badges, fresh := Evaluate(Stats{CreatedAt: FounderCutoff, Proposals: 0}, stored, now)
	if b := find(t, badges, "contribuinte"); b.Tier != 1 || b.Value != 0 {
		t.Fatalf("contribuinte = %+v, want tier 1 kept with value 0", b)
	}
	for _, u := range fresh {
		if u.Category == "contribuinte" {
			t.Fatalf("unlocked again: %+v", u)
		}
	}
}

func TestRefreshAnnouncesContribuinteRightAway(t *testing.T) {
	s, st, pub, _, _ := newTestService()
	st.stats["ana"] = Stats{CreatedAt: FounderCutoff, Proposals: 1}

	s.Refresh(context.Background(), "ana")
	if len(pub.events) != 1 || len(pub.events[0].Unlocks) != 1 {
		t.Fatalf("events = %+v, want one unlock", pub.events)
	}
	if u := pub.events[0].Unlocks[0]; u.Category != "contribuinte" || u.Tier != 1 || u.TierName != "Ideia" || u.Name != "Contribuinte" {
		t.Fatalf("unlock = %+v", u)
	}

	// O segundo card não muda o tier: nada de aviso.
	st.stats["ana"] = Stats{CreatedAt: FounderCutoff, Proposals: 2}
	s.Refresh(context.Background(), "ana")
	if len(pub.events) != 1 {
		t.Fatalf("announced again: %+v", pub.events)
	}
}

func TestRefreshUnknownUserDoesNotPanic(t *testing.T) {
	s, _, pub, _, _ := newTestService()
	s.Refresh(context.Background(), "ghost")
	if len(pub.events) != 0 {
		t.Fatalf("events = %+v", pub.events)
	}
}

// O backfill da migration usa os mesmos limites do catálogo.
func TestContribuinteBackfillMatchesCatalog(t *testing.T) {
	raw, err := os.ReadFile(contribuinteMigration)
	if err != nil {
		t.Fatal(err)
	}
	var want []string
	for i, tier := range contribuinte(t).Tiers {
		want = append(want, fmt.Sprintf("(%d, %d)", i+1, tier.Threshold))
	}
	m := regexp.MustCompile(`VALUES\s*(.+?)\)\s*AS t`).FindStringSubmatch(string(raw))
	if m == nil {
		t.Fatal("VALUES list not found in the migration")
	}
	if got := m[1]; got != strings.Join(want, ", ") {
		t.Fatalf("migration thresholds = %s, want %s", got, strings.Join(want, ", "))
	}
}

// Contagem e backfill num Postgres de verdade (TEST_DATABASE_URL).
func TestContribuinteDB(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL não definido")
	}
	ctx := context.Background()
	db, err := database.Connect(url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(db, "../../migrations"); err != nil {
		t.Fatal(err)
	}
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	newUser := func() string {
		id := uuid.NewString()
		name := "c" + strings.ReplaceAll(id, "-", "")[:12]
		exec(`INSERT INTO users (id, username, display_name, email, password_hash) VALUES ($1, $2::text, $2::text, $2::text || '@ex.com', 'x')`, id, name)
		t.Cleanup(func() { db.Exec(ctx, `DELETE FROM users WHERE id = $1`, id) })
		return id
	}
	ana, bia := newUser(), newUser()
	base := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)
	card := func(author, status string, n int) string {
		id := uuid.NewString()
		at := base.Add(time.Duration(n) * time.Hour)
		exec(`INSERT INTO proposals (id, author_id, title, status, created_at, voting_ends_at) VALUES ($1, $2, 'Ideia', $3, $4, $4)`, id, author, status, at)
		return id
	}
	// Ana: 6 cards (um rejeitado, um apagado depois); Bia: 1.
	statuses := []string{"voting", "proposed", "rejected", "done", "in_progress", "voting"}
	var anaCards []string
	for i, st := range statuses {
		anaCards = append(anaCards, card(ana, st, i))
	}
	card(bia, "voting", 0)

	repo := BadgeRepository(db)
	s, err := repo.Stats(ctx, ana)
	if err != nil || s.Proposals != 6 {
		t.Fatalf("ana proposals = %d, %v (want 6: rejected counts)", s.Proposals, err)
	}

	// Backfill do deploy: tier 1 no 1º card, tier 2 no 5º.
	raw, err := os.ReadFile(contribuinteMigration)
	if err != nil {
		t.Fatal(err)
	}
	exec(string(raw))
	exec(string(raw)) // de novo não duplica
	unlocks, err := repo.Unlocks(ctx, ana)
	if err != nil {
		t.Fatal(err)
	}
	got := unlocks["contribuinte"]
	if len(got) != 2 || !got[1].Equal(base) || !got[2].Equal(base.Add(4*time.Hour)) {
		t.Fatalf("ana backfill = %v", got)
	}
	if b, _ := repo.Unlocks(ctx, bia); len(b["contribuinte"]) != 1 {
		t.Fatalf("bia backfill = %v", b["contribuinte"])
	}

	// Card apagado sai da contagem (o tier gravado fica, regra do Evaluate).
	exec(`DELETE FROM proposals WHERE id = $1`, anaCards[1])
	if s, err = repo.Stats(ctx, ana); err != nil || s.Proposals != 5 {
		t.Fatalf("after delete proposals = %d, %v", s.Proposals, err)
	}
}
