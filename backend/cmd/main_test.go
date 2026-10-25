package main

import (
	"context"
	"errors"
	"net/http/httptest"
	"testing"
	"time"
)

func TestIsLongDownload(t *testing.T) {
	cases := []struct {
		method, path string
		want         bool
	}{
		{"GET", "/updates/Salinha-0.7.0-setup.exe", true},
		{"HEAD", "/updates/latest.yml", true},
		{"GET", "/api/media/3f2a", true},
		{"GET", "/api/media/token", false},
		{"POST", "/api/channels/1/attachments", false},
		{"GET", "/api/channels/1/messages", false},
		{"GET", "/ws", false},
	}
	for _, c := range cases {
		if got := isLongDownload(httptest.NewRequest(c.method, c.path, nil)); got != c.want {
			t.Errorf("%s %s = %v, want %v", c.method, c.path, got, c.want)
		}
	}
}

type flakyRestore struct{ failures int }

func (f *flakyRestore) RestoreActive(context.Context) error {
	if f.failures > 0 {
		f.failures--
		return errors.New("banco fora")
	}
	return nil
}

func TestRestoreCallsRetriesUntilItWorks(t *testing.T) {
	f := &flakyRestore{failures: 1}
	if err := restoreCalls(context.Background(), f, 5*time.Second); err != nil {
		t.Fatalf("restoreCalls = %v", err)
	}
}

func TestRestoreCallsGivesUp(t *testing.T) {
	f := &flakyRestore{failures: 100}
	begin := time.Now()
	if err := restoreCalls(context.Background(), f, 1500*time.Millisecond); err == nil {
		t.Fatal("restoreCalls = nil com o banco sempre fora")
	}
	if waited := time.Since(begin); waited > 4*time.Second {
		t.Fatalf("esperou %v", waited)
	}
}

func TestMigrationsDirFromEnv(t *testing.T) {
	t.Setenv("MIGRATIONS_DIR", "migrations.new")
	if got := findMigrationsDir(); got != "migrations.new" {
		t.Fatalf("findMigrationsDir = %q, want migrations.new", got)
	}
}
