package message

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"testing"
	"time"

	"gin-quickstart/backend/internal/platform/media"

	"github.com/google/uuid"
)

func TestOrphanFiles(t *testing.T) {
	now := time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)
	old := now.Add(-2 * time.Hour)
	fresh := now.Add(-10 * time.Minute)

	files := []media.FileInfo{
		{Name: "known", ID: "known", ModTime: old},                  // conhecido e velho → fica
		{Name: "gone", ID: "gone", ModTime: old},                    // linha sumiu por cascata → sai
		{Name: "arriving", ID: "arriving", ModTime: fresh},          // upload terminando agora → fica
		{Name: ".tmp-stuck", ID: "stuck", Temp: true, ModTime: old}, // temporário velho → sai
		{Name: ".tmp-live", ID: "live", Temp: true, ModTime: fresh}, // temporário novo → fica
	}
	known := map[string]bool{"known": true}

	got := orphanFiles(files, known, now, time.Hour)
	sort.Strings(got)
	want := []string{".tmp-stuck", "gone"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("orphanFiles = %v, want %v", got, want)
	}
}

type fakeJanitorRepo struct {
	rows  map[string]bool
	stale []string
}

func (r *fakeJanitorRepo) DeleteStalePending(context.Context, time.Time) ([]string, error) {
	return r.stale, nil
}

func (r *fakeJanitorRepo) KnownAttachmentIDs(_ context.Context, ids []string) (map[string]bool, error) {
	known := map[string]bool{}
	for _, id := range ids {
		if r.rows[id] {
			known[id] = true
		}
	}
	return known, nil
}

func (r *fakeJanitorRepo) CountAttachments(context.Context) (int64, error) {
	return int64(len(r.rows)), nil
}

// janitorEnv cria um store com arquivos "velhos" (fora da carência).
func janitorEnv(t *testing.T, now time.Time, ids ...string) (*media.Store, string) {
	t.Helper()
	dir := t.TempDir()
	store, err := media.NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	old := now.Add(-2 * time.Hour)
	for _, id := range ids {
		if _, _, err := store.Save(id, bytes.NewReader([]byte("x")), 1024); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(filepath.Join(dir, id), old, old); err != nil {
			t.Fatal(err)
		}
	}
	return store, dir
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func TestRunOnceMovesOrphansToTrash(t *testing.T) {
	now := time.Now()
	live, orphan := uuid.NewString(), uuid.NewString()
	store, dir := janitorEnv(t, now, live, orphan)
	j := NewJanitor(&fakeJanitorRepo{rows: map[string]bool{live: true}}, store)

	if err := j.RunOnce(context.Background(), now); err != nil {
		t.Fatal(err)
	}
	if !exists(filepath.Join(dir, live)) {
		t.Fatal("arquivo com linha no banco não pode sair")
	}
	if exists(filepath.Join(dir, orphan)) {
		t.Fatal("órfão deveria sair da pasta principal")
	}
	if !exists(filepath.Join(dir, media.TrashDir, orphan)) {
		t.Fatal("órfão deveria ir para a lixeira, não ser apagado")
	}
}

func TestRunOnceSkipsSweepWhenDatabaseHasNoAttachments(t *testing.T) {
	// Banco vazio (volume perdido, restore ainda não feito, DATABASE_URL
	// errado) com arquivos no disco: não mexe em nada.
	now := time.Now()
	a, b := uuid.NewString(), uuid.NewString()
	store, dir := janitorEnv(t, now, a, b)
	j := NewJanitor(&fakeJanitorRepo{rows: map[string]bool{}}, store)

	if err := j.RunOnce(context.Background(), now); err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{a, b} {
		if !exists(filepath.Join(dir, id)) {
			t.Fatalf("%s não deveria ter saído com o banco vazio", id)
		}
	}
	if exists(filepath.Join(dir, media.TrashDir)) {
		t.Fatal("nada deveria ir para a lixeira")
	}
}

func TestRunOnceStillDeletesStalePendingUploads(t *testing.T) {
	now := time.Now()
	stale := uuid.NewString()
	store, dir := janitorEnv(t, now, stale)
	j := NewJanitor(&fakeJanitorRepo{rows: map[string]bool{}, stale: []string{stale}}, store)

	if err := j.RunOnce(context.Background(), now); err != nil {
		t.Fatal(err)
	}
	if exists(filepath.Join(dir, stale)) || exists(filepath.Join(dir, media.TrashDir, stale)) {
		t.Fatal("upload pendente vencido continua sendo apagado de vez")
	}
}

func TestRunOncePurgesOldTrash(t *testing.T) {
	now := time.Now()
	gone := uuid.NewString()
	store, dir := janitorEnv(t, now, gone)
	if err := store.Trash(gone, now.Add(-8*24*time.Hour)); err != nil {
		t.Fatal(err)
	}
	j := NewJanitor(&fakeJanitorRepo{rows: map[string]bool{}}, store)

	if err := j.RunOnce(context.Background(), now); err != nil {
		t.Fatal(err)
	}
	if exists(filepath.Join(dir, media.TrashDir, gone)) {
		t.Fatal("item da lixeira com mais de 7 dias deveria ser apagado")
	}
}
