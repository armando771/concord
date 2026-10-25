package updates

import (
	"context"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"
)

func writeManifest(t *testing.T, dir, name, content string, mtime time.Time) {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	// mtime explícito: o teste não depende da resolução do relógio do disco.
	if err := os.Chtimes(path, mtime, mtime); err != nil {
		t.Fatal(err)
	}
}

func TestParseVersion(t *testing.T) {
	cases := map[string]string{
		"version: 0.7.0\npath: Salinha-0.7.0-setup.exe\n":          "0.7.0",
		"version: '0.7.1'\n":                                       "0.7.1",
		"version: \"0.8.0\"\r\nfiles:\n":                           "0.8.0",
		"files:\n  - url: x\n    version: 9.9.9\nversion: 1.0.0\n": "1.0.0", // só a chave do topo
		"path: x\n":     "",
		"version: \n":   "",
		"versions: 1\n": "",
		"":              "",
	}
	for in, want := range cases {
		if got := parseVersion([]byte(in)); got != want {
			t.Errorf("parseVersion(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestWatcherAnnouncesOnlyVersionChanges(t *testing.T) {
	dir := t.TempDir()
	base := time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)
	writeManifest(t, dir, "latest.yml", "version: 0.6.0\n", base)

	var got []Release
	w := NewWatcher(dir, func(r Release) { got = append(got, r) })

	// Ao subir, só aprende o que já estava publicado (reinício não é release).
	w.Poll()
	if len(got) != 0 {
		t.Fatalf("anunciou ao subir: %v", got)
	}

	// Mesmo arquivo, nada muda.
	w.Poll()
	if len(got) != 0 {
		t.Fatalf("anunciou sem mudança: %v", got)
	}

	// Regravado com a mesma versão (outro mtime): não é versão nova.
	writeManifest(t, dir, "latest.yml", "version: 0.6.0\npath: x\n", base.Add(time.Minute))
	w.Poll()
	if len(got) != 0 {
		t.Fatalf("anunciou a mesma versão: %v", got)
	}

	// Versão nova.
	writeManifest(t, dir, "latest.yml", "version: 0.7.0\n", base.Add(2*time.Minute))
	w.Poll()
	want := []Release{{File: "latest.yml", Version: "0.7.0"}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestWatcherAnnouncesManifestPublishedAfterStart(t *testing.T) {
	// O deploy reinicia o backend e só depois publica o manifesto do Linux.
	dir := t.TempDir()
	base := time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)
	var got []Release
	w := NewWatcher(dir, func(r Release) { got = append(got, r) })
	w.Poll()

	writeManifest(t, dir, "latest-linux.yml", "version: 0.7.0\npath: Salinha-0.7.0-x64.AppImage\n", base)
	w.Poll()

	want := []Release{{File: "latest-linux.yml", Version: "0.7.0"}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestWatcherRetriesHalfWrittenManifest(t *testing.T) {
	dir := t.TempDir()
	base := time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)
	writeManifest(t, dir, "latest.yml", "version: 0.6.0\n", base)
	var got []Release
	w := NewWatcher(dir, func(r Release) { got = append(got, r) })
	w.Poll()

	// Pego no meio da cópia: sem versão ainda. Não anuncia nem esquece o mtime
	// errado — a próxima leitura (mesmo mtime) tenta de novo.
	later := base.Add(time.Minute)
	writeManifest(t, dir, "latest.yml", "pa", later)
	w.Poll()
	writeManifest(t, dir, "latest.yml", "version: 0.7.0\n", later)
	w.Poll()

	want := []Release{{File: "latest.yml", Version: "0.7.0"}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestWatcherManifestRemovedAndRepublished(t *testing.T) {
	dir := t.TempDir()
	base := time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)
	writeManifest(t, dir, "latest.yml", "version: 0.6.0\n", base)
	var got []Release
	w := NewWatcher(dir, func(r Release) { got = append(got, r) })
	w.Poll()

	if err := os.Remove(filepath.Join(dir, "latest.yml")); err != nil {
		t.Fatal(err)
	}
	w.Poll()
	// Voltou a mesma versão: nada de novo para os apps.
	writeManifest(t, dir, "latest.yml", "version: 0.6.0\n", base.Add(time.Minute))
	w.Poll()
	if len(got) != 0 {
		t.Fatalf("anunciou a mesma versão: %v", got)
	}
}

func TestWatcherRunPollsUntilCancelled(t *testing.T) {
	dir := t.TempDir()
	writeManifest(t, dir, "latest.yml", "version: 0.6.0\n", time.Now().Add(-time.Hour))
	found := make(chan Release, 1)
	w := NewWatcher(dir, func(r Release) { found <- r })

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		w.Run(ctx, 5*time.Millisecond)
		close(done)
	}()

	time.Sleep(20 * time.Millisecond)
	writeManifest(t, dir, "latest.yml", "version: 0.7.0\n", time.Now())

	select {
	case r := <-found:
		if r.Version != "0.7.0" {
			t.Fatalf("versão %q", r.Version)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Run não anunciou a versão nova")
	}
	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Run não parou com o contexto cancelado")
	}
}
