package changelog

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"testing"
	"time"

	"gin-quickstart/backend/internal/platform/database"
)

const dedupMigration = "../../migrations/000061_dedup_changelog_entries.up.sql"

// A migration de limpeza num Postgres de verdade (TEST_DATABASE_URL, banco
// descartável): cada nota fica só na release mais antiga que a trouxe.
func TestDedupMigrationKeepsEachNoteInItsFirstRelease(t *testing.T) {
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
	run := fmt.Sprint(time.Now().UnixNano())
	repo := NewRepository(db)
	base := time.Now().Add(-time.Hour)
	// Como o deploy fazia: cada versão republica tudo o que veio antes.
	for i, notes := range [][]string{{"A"}, {"A", "B"}, {"A", "B"}} {
		at := base.Add(time.Duration(i) * time.Minute)
		p := Publication{ReleasedAt: &at}
		for _, n := range notes {
			p.Entries = append(p.Entries, Entry{Kind: KindFeature, Text: n + " " + run})
		}
		if err := repo.Upsert(ctx, fmt.Sprintf("9.%s.%d", run, i), p); err != nil {
			t.Fatal(err)
		}
	}
	sql, err := os.ReadFile(dedupMigration)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, string(sql)); err != nil {
		t.Fatal(err)
	}
	releases, err := repo.List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	got := map[string][]Entry{}
	for _, r := range releases {
		got[r.Version] = r.Entries
	}
	want := map[string][]Entry{
		"9." + run + ".0": {{KindFeature, "A " + run}},
		"9." + run + ".1": {{KindFeature, "B " + run}},
		"9." + run + ".2": {},
	}
	for v, w := range want {
		if !reflect.DeepEqual(got[v], w) {
			t.Errorf("%s = %+v, quer %+v", v, got[v], w)
		}
	}
}
