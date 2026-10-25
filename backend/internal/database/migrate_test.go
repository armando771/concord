package database

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeMigrations(t *testing.T, names ...string) string {
	t.Helper()
	dir := t.TempDir()
	for _, n := range names {
		if err := os.WriteFile(filepath.Join(dir, n), []byte("SELECT 1;"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

// Duas branches com o mesmo número: uma das migrations nunca rodaria. O
// backend não sobe (e o deploy para antes de reiniciar).
func TestLoadMigrationsRefusesDuplicateNumbers(t *testing.T) {
	dir := writeMigrations(t,
		"000018_add_birthdays.up.sql",
		"000019_create_soundboard_sounds.up.sql",
		"000019_add_login_username.up.sql",
		"000019_add_login_username.down.sql",
	)
	_, err := loadMigrations(dir)
	if err == nil {
		t.Fatal("loadMigrations aceitou dois arquivos com o número 000019")
	}
	if !strings.Contains(err.Error(), "000019") ||
		!strings.Contains(err.Error(), "000019_create_soundboard_sounds.up.sql") ||
		!strings.Contains(err.Error(), "000019_add_login_username.up.sql") {
		t.Fatalf("erro não diz quais arquivos: %v", err)
	}
}

func TestLoadMigrationsSortsUniqueNumbers(t *testing.T) {
	dir := writeMigrations(t, "000002_b.up.sql", "000001_a.up.sql", "000001_a.down.sql")
	got, err := loadMigrations(dir)
	if err != nil {
		t.Fatalf("loadMigrations: %v", err)
	}
	if len(got) != 2 || got[0].version != 1 || got[1].version != 2 {
		t.Fatalf("got %+v", got)
	}
}

// Migration com número menor que a versão do banco que nunca rodou (chegou
// depois de outra maior já aplicada): o migrador a pularia em silêncio.
func TestNeverAppliedFindsSkippedMigrations(t *testing.T) {
	files := []migrationFile{
		{version: 20, fileName: "000020_add_user_profile.up.sql"},
		{version: 21, fileName: "000021_add_login_username.up.sql"},
		{version: 23, fileName: "000023_add_call_participant_state.up.sql"},
		{version: 24, fileName: "000024_add_mentions_all.up.sql"},
	}
	applied := map[int]bool{20: true, 23: true}

	got := neverApplied(files, 23, applied)

	if len(got) != 1 || got[0].version != 21 {
		t.Fatalf("neverApplied = %+v, want só a 000021 (a 000024 ainda vai rodar)", got)
	}
}

func TestNeverAppliedEmptyWhenHistoryComplete(t *testing.T) {
	files := []migrationFile{{version: 1}, {version: 2}, {version: 3}}
	if got := neverApplied(files, 2, map[int]bool{1: true, 2: true}); len(got) != 0 {
		t.Fatalf("neverApplied = %+v", got)
	}
}
