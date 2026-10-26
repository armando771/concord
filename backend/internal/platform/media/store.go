package media

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	ErrTooLarge    = errors.New("file too large")
	ErrInvalidName = errors.New("invalid file name")
)

const tempPrefix = ".tmp-"

// Store guarda cada anexo num arquivo "<uuid>" dentro de dir. Enquanto o
// upload chega ele fica em ".tmp-<uuid>" e só é renomeado quando termina.
type Store struct {
	dir string
}

func NewStore(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, fmt.Errorf("create uploads dir: %w", err)
	}
	return &Store{dir: dir}, nil
}

// Save grava r em <dir>/<id> lendo no máximo limit bytes (passou disso →
// ErrTooLarge). Em qualquer erro não sobra arquivo. head são os primeiros
// SniffLen bytes, para o Sniff.
func (s *Store) Save(id string, r io.Reader, limit int64) (size int64, head []byte, err error) {
	if _, err := uuid.Parse(id); err != nil {
		return 0, nil, ErrInvalidName
	}
	tmp := filepath.Join(s.dir, tempPrefix+id)
	f, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o640)
	if err != nil {
		return 0, nil, err
	}
	defer func() {
		if err != nil {
			f.Close()
			os.Remove(tmp)
		}
	}()

	limited := io.LimitReader(r, limit+1)
	head = make([]byte, SniffLen)
	n, err := io.ReadFull(limited, head)
	if err != nil && !errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) {
		return 0, nil, err
	}
	head = head[:n]
	if _, err = f.Write(head); err != nil {
		return 0, nil, err
	}
	rest, err := io.Copy(f, limited)
	if err != nil {
		return 0, nil, err
	}
	size = int64(n) + rest
	if size > limit {
		return 0, nil, ErrTooLarge
	}
	if err = f.Sync(); err != nil {
		return 0, nil, err
	}
	if err = f.Close(); err != nil {
		return 0, nil, err
	}
	if err = os.Rename(tmp, filepath.Join(s.dir, id)); err != nil {
		return 0, nil, err
	}
	return size, head, nil
}

func (s *Store) Open(id string) (*os.File, error) {
	if _, err := uuid.Parse(id); err != nil {
		return nil, ErrInvalidName
	}
	return os.Open(filepath.Join(s.dir, id))
}

// Remove apaga "<uuid>" ou ".tmp-<uuid>"; arquivo que já não existe não é erro.
func (s *Store) Remove(name string) error {
	if _, _, ok := parseName(name); !ok {
		return ErrInvalidName
	}
	if err := os.Remove(filepath.Join(s.dir, name)); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

type FileInfo struct {
	Name    string
	ID      string
	Temp    bool
	ModTime time.Time
}

// List devolve os arquivos da pasta com nome de anexo (ignora o resto).
func (s *Store) List() ([]FileInfo, error) {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return nil, err
	}
	var files []FileInfo
	for _, e := range entries {
		if !e.Type().IsRegular() {
			continue
		}
		id, temp, ok := parseName(e.Name())
		if !ok {
			continue
		}
		info, err := e.Info()
		if err != nil {
			// Sumiu entre o ReadDir e o Info (ex.: upload renomeado).
			continue
		}
		files = append(files, FileInfo{Name: e.Name(), ID: id, Temp: temp, ModTime: info.ModTime()})
	}
	return files, nil
}

func parseName(name string) (id string, temp bool, ok bool) {
	id, temp = strings.CutPrefix(name, tempPrefix)
	parsed, err := uuid.Parse(id)
	if err != nil || parsed.String() != id {
		return "", false, false
	}
	return id, temp, true
}

// TrashDir é a lixeira dentro da pasta de mídia: o que a limpeza acha órfão
// vai para lá e só é apagado depois de TrashTTL. Assim um banco vazio ou
// restaurado tarde não apaga a mídia de vez (a mídia não tem backup).
const TrashDir = ".trash"

const TrashTTL = 7 * 24 * time.Hour

// Trash move "<uuid>" ou ".tmp-<uuid>" para a lixeira, marcando a hora em que
// entrou (o PurgeTrash conta a partir dela).
func (s *Store) Trash(name string, now time.Time) error {
	if _, _, ok := parseName(name); !ok {
		return ErrInvalidName
	}
	trash := filepath.Join(s.dir, TrashDir)
	if err := os.MkdirAll(trash, 0o750); err != nil {
		return err
	}
	dest := filepath.Join(trash, name)
	if err := os.Rename(filepath.Join(s.dir, name), dest); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	return os.Chtimes(dest, now, now)
}

// PurgeTrash apaga de vez o que entrou na lixeira antes de before.
func (s *Store) PurgeTrash(before time.Time) (int, error) {
	trash := filepath.Join(s.dir, TrashDir)
	entries, err := os.ReadDir(trash)
	if errors.Is(err, os.ErrNotExist) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	purged := 0
	for _, e := range entries {
		if _, _, ok := parseName(e.Name()); !ok || !e.Type().IsRegular() {
			continue
		}
		info, err := e.Info()
		if err != nil || !info.ModTime().Before(before) {
			continue
		}
		if err := os.Remove(filepath.Join(trash, e.Name())); err != nil && !errors.Is(err, os.ErrNotExist) {
			return purged, err
		}
		purged++
	}
	return purged, nil
}
