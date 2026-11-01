package music

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const sessionsMigration = "../../migrations/000167_music_sessions.up.sql"

// newSessionDB: só a tabela da migration 000167, num schema descartável do
// Postgres de TEST_DATABASE_URL (sem rodar as migrations todas).
func newSessionDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL não definido")
	}
	ctx := context.Background()
	schema := fmt.Sprintf("music_test_%d", time.Now().UnixNano())
	admin, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(admin.Close)
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE") })
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	sql, err := os.ReadFile(sessionsMigration)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, string(sql)); err != nil {
		t.Fatal(err)
	}
	return db
}

const (
	chA  = "00000000-0000-0000-0000-00000000000a"
	chB  = "00000000-0000-0000-0000-00000000000b"
	srv  = "00000000-0000-0000-0000-000000000001"
	cal  = "00000000-0000-0000-0000-000000000002"
	txt  = "00000000-0000-0000-0000-000000000003"
	user = "00000000-0000-0000-0000-000000000004"
)

func TestSessionRepositorySaveListDelete(t *testing.T) {
	repo := NewSessionRepository(newSessionDB(t))
	ctx := context.Background()
	saved := time.Now().Truncate(time.Millisecond)
	avatar := "https://x/a.png"
	by := UserRef{ID: user, Username: "ana", DisplayName: "Ana", AvatarURL: &avatar}
	now := &Item{ID: "i1", Track: Track{VideoID: "dQw4w9WgXcQ", Title: "Never", Artist: "Rick", DurationMs: 213_000, HasVideo: true}, RequestedBy: by, TextChannelID: txt, AudioPath: "/tmp/a"}
	next := &Item{ID: "i2", Track: Track{VideoID: "fJ9rUzIMcZQ", Title: "Bohemian"}, RequestedBy: by, TextChannelID: txt}

	if err := repo.Save(ctx, Session{ChannelID: chA, ServerID: srv, CallID: cal, TextChannelID: txt, Now: now, Position: 90500 * time.Millisecond, Queue: []*Item{next}, SavedAt: saved}); err != nil {
		t.Fatal(err)
	}
	// Entre uma faixa e outra, sem canal de texto: a atual fica NULL.
	if err := repo.Save(ctx, Session{ChannelID: chB, ServerID: srv, CallID: cal, Queue: []*Item{next}, SavedAt: saved.Add(time.Second)}); err != nil {
		t.Fatal(err)
	}
	// Gravar de novo troca a do canal.
	if err := repo.Save(ctx, Session{ChannelID: chA, ServerID: srv, CallID: cal, TextChannelID: txt, Now: now, Position: 95 * time.Second, Queue: []*Item{next}, SavedAt: saved}); err != nil {
		t.Fatal(err)
	}

	list, err := repo.List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 {
		t.Fatalf("sessões = %d", len(list))
	}
	a := list[0]
	if a.ChannelID != chA || a.CallID != cal || a.ServerID != srv || a.TextChannelID != txt || a.Position != 95*time.Second || !a.SavedAt.Equal(saved) {
		t.Fatalf("sessão A = %+v", a)
	}
	if a.Now == nil || a.Now.Track != now.Track || a.Now.ID != "i1" || a.Now.RequestedBy.Username != "ana" || *a.Now.RequestedBy.AvatarURL != avatar || a.Now.AudioPath != "" {
		t.Fatalf("faixa atual = %+v", a.Now)
	}
	if len(a.Queue) != 1 || a.Queue[0].Track.VideoID != "fJ9rUzIMcZQ" {
		t.Fatalf("fila = %+v", a.Queue)
	}
	if b := list[1]; b.Now != nil || b.TextChannelID != "" || len(b.Queue) != 1 {
		t.Fatalf("sessão B = %+v", b)
	}

	if err := repo.Delete(ctx, chA); err != nil {
		t.Fatal(err)
	}
	if list, _ := repo.List(ctx); len(list) != 1 || list[0].ChannelID != chB {
		t.Fatalf("depois de apagar = %+v", list)
	}
}

// O JSON das colunas, sem banco: o caminho de volta devolve a mesma sessão
// (sem os arquivos do cache) e JSON estragado vira erro, não sessão vazia.
func TestSessionItemsJSONRoundTrip(t *testing.T) {
	by := UserRef{ID: user, Username: "ana"}
	in := Session{
		Now:   &Item{ID: "i1", Track: Track{VideoID: "dQw4w9WgXcQ", Title: "Never", DurationMs: 213_000}, RequestedBy: by, AudioPath: "/tmp/a"},
		Queue: []*Item{{ID: "i2", Track: Track{VideoID: "fJ9rUzIMcZQ"}, RequestedBy: by}},
	}
	now, queue := encodeSessionItems(in)
	var out Session
	if err := decodeSessionItems([]byte(now), []byte(queue), &out); err != nil {
		t.Fatal(err)
	}
	if out.Now == nil || out.Now.Track != in.Now.Track || out.Now.AudioPath != "" || len(out.Queue) != 1 || out.Queue[0].ID != "i2" {
		t.Fatalf("ida e volta = %+v / %+v", out.Now, out.Queue)
	}

	now, queue = encodeSessionItems(Session{})
	if now != "null" || queue != "[]" {
		t.Fatalf("vazia = %s / %s", now, queue)
	}
	var empty Session
	if err := decodeSessionItems(nil, []byte(queue), &empty); err != nil || empty.Now != nil || len(empty.Queue) != 0 {
		t.Fatalf("vazia de volta = %+v (%v)", empty, err)
	}

	for _, c := range [][2]string{{"{", "[]"}, {"null", "{"}} {
		if err := decodeSessionItems([]byte(c[0]), []byte(c[1]), &Session{}); err == nil {
			t.Errorf("JSON estragado %q/%q passou", c[0], c[1])
		}
	}
}
