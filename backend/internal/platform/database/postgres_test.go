package database

import (
	"testing"
	"time"
)

// Na subida da VPS o backend pode chegar antes do Postgres do Docker: em vez
// de morrer na primeira tentativa (e o systemd desistir), tenta de novo.
func TestConnectWithRetryKeepsTryingUntilDeadline(t *testing.T) {
	begin := time.Now()
	_, err := ConnectWithRetry("postgres://u:p@127.0.0.1:1/x?sslmode=disable", 1200*time.Millisecond)
	if err == nil {
		t.Fatal("conectou numa porta fechada")
	}
	if waited := time.Since(begin); waited < time.Second || waited > 4*time.Second {
		t.Fatalf("desistiu em %v, want ~1,2 s", waited)
	}
}

func TestConnectWithRetryRejectsBadURLAtOnce(t *testing.T) {
	begin := time.Now()
	if _, err := ConnectWithRetry("::não é url", 5*time.Second); err == nil {
		t.Fatal("aceitou URL inválida")
	}
	if waited := time.Since(begin); waited > time.Second {
		t.Fatalf("URL inválida esperou %v", waited)
	}
}
