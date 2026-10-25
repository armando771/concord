package media

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestSaveWritesFileAndHead(t *testing.T) {
	dir := t.TempDir()
	s, err := NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	data := bytes.Repeat([]byte("ab"), 300)
	id := uuid.NewString()

	size, head, err := s.Save(id, bytes.NewReader(data), 1024)
	if err != nil {
		t.Fatalf("Save: %v", err)
	}
	if size != 600 || len(head) != 512 {
		t.Fatalf("size=%d head=%d, want 600 e 512", size, len(head))
	}
	got, err := os.ReadFile(filepath.Join(dir, id))
	if err != nil || !bytes.Equal(got, data) {
		t.Fatalf("arquivo salvo diferente: %v", err)
	}
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".tmp-") {
			t.Fatalf("sobrou temporário %s", e.Name())
		}
	}
}

func TestSaveOverLimitLeavesNothing(t *testing.T) {
	dir := t.TempDir()
	s, _ := NewStore(dir)
	_, _, err := s.Save(uuid.NewString(), bytes.NewReader(make([]byte, 1025)), 1024)
	if !errors.Is(err, ErrTooLarge) {
		t.Fatalf("err = %v, want ErrTooLarge", err)
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 0 {
		t.Fatalf("pasta deveria estar vazia, tem %d itens", len(entries))
	}
}

func TestSaveRejectsBadID(t *testing.T) {
	s, _ := NewStore(t.TempDir())
	if _, _, err := s.Save("../x", bytes.NewReader([]byte("x")), 1024); !errors.Is(err, ErrInvalidName) {
		t.Fatalf("err = %v, want ErrInvalidName", err)
	}
}

func TestRemove(t *testing.T) {
	dir := t.TempDir()
	s, _ := NewStore(dir)
	if err := s.Remove(uuid.NewString()); err != nil {
		t.Fatalf("remover inexistente: %v", err)
	}
	if err := s.Remove("../../etc/passwd"); !errors.Is(err, ErrInvalidName) {
		t.Fatalf("err = %v, want ErrInvalidName", err)
	}
	id := uuid.NewString()
	if _, _, err := s.Save(id, bytes.NewReader([]byte("oi")), 1024); err != nil {
		t.Fatal(err)
	}
	if err := s.Remove(id); err != nil {
		t.Fatalf("Remove: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, id)); !os.IsNotExist(err) {
		t.Fatalf("arquivo continua lá: %v", err)
	}
}

func TestListReportsIDsAndTemp(t *testing.T) {
	dir := t.TempDir()
	s, _ := NewStore(dir)
	id, id2 := uuid.NewString(), uuid.NewString()
	for _, name := range []string{id, ".tmp-" + id2, "notas.txt"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("x"), 0o640); err != nil {
			t.Fatal(err)
		}
	}
	files, err := s.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 2 {
		t.Fatalf("List = %d itens, want 2", len(files))
	}
	var sawFile, sawTemp bool
	for _, f := range files {
		switch {
		case !f.Temp && f.ID == id && f.Name == id:
			sawFile = true
		case f.Temp && f.ID == id2 && f.Name == ".tmp-"+id2:
			sawTemp = true
		}
		if f.ModTime.IsZero() {
			t.Fatalf("ModTime vazio em %s", f.Name)
		}
	}
	if !sawFile || !sawTemp {
		t.Fatalf("List = %+v", files)
	}
}

func TestTrashMovesFileAndPurgeRemovesOldOnes(t *testing.T) {
	dir := t.TempDir()
	s, _ := NewStore(dir)
	now := time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)
	oldID, newID := uuid.NewString(), uuid.NewString()
	for _, id := range []string{oldID, newID} {
		if _, _, err := s.Save(id, bytes.NewReader([]byte("x")), 1024); err != nil {
			t.Fatal(err)
		}
	}
	if err := s.Trash(oldID, now.Add(-8*24*time.Hour)); err != nil {
		t.Fatalf("Trash: %v", err)
	}
	if err := s.Trash(newID, now.Add(-time.Hour)); err != nil {
		t.Fatalf("Trash: %v", err)
	}
	if err := s.Trash("../../etc/passwd", now); !errors.Is(err, ErrInvalidName) {
		t.Fatalf("err = %v, want ErrInvalidName", err)
	}
	if _, err := os.Stat(filepath.Join(dir, oldID)); !os.IsNotExist(err) {
		t.Fatal("arquivo deveria ter saído da pasta principal")
	}
	if _, err := os.Stat(filepath.Join(dir, TrashDir, oldID)); err != nil {
		t.Fatalf("arquivo deveria estar na lixeira: %v", err)
	}
	// A lixeira é uma pasta: List não a devolve como anexo.
	if files, _ := s.List(); len(files) != 0 {
		t.Fatalf("List = %+v, want vazio", files)
	}

	purged, err := s.PurgeTrash(now.Add(-TrashTTL))
	if err != nil || purged != 1 {
		t.Fatalf("PurgeTrash = (%d, %v), want 1", purged, err)
	}
	if _, err := os.Stat(filepath.Join(dir, TrashDir, oldID)); !os.IsNotExist(err) {
		t.Fatal("item com mais de 7 dias deveria sumir")
	}
	if _, err := os.Stat(filepath.Join(dir, TrashDir, newID)); err != nil {
		t.Fatalf("item recente deveria ficar: %v", err)
	}
}

func TestPurgeTrashWithoutTrashDir(t *testing.T) {
	s, _ := NewStore(t.TempDir())
	if n, err := s.PurgeTrash(time.Now()); err != nil || n != 0 {
		t.Fatalf("PurgeTrash sem lixeira = (%d, %v)", n, err)
	}
}

// A mídia do perfil fica numa subpasta (uploads/profile): a limpeza dos
// anexos lista só a raiz e nunca pode mandar avatar para a lixeira.
func TestListIgnoresSubdirectories(t *testing.T) {
	dir := t.TempDir()
	s, _ := NewStore(dir)
	profile, _ := NewStore(filepath.Join(dir, "profile"))
	if _, _, err := profile.Save(uuid.NewString(), strings.NewReader("avatar"), 100); err != nil {
		t.Fatal(err)
	}
	files, err := s.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 0 {
		t.Fatalf("List enxergou a subpasta: %+v", files)
	}
}
