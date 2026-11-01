package ratelimit

import (
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type clock struct{ t time.Time }

func (c *clock) now() time.Time          { return c.t }
func (c *clock) advance(d time.Duration) { c.t = c.t.Add(d) }

func newTest(limit int, window time.Duration, maxKeys int) (*Limiter, *clock) {
	c := &clock{t: time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)}
	l := New(limit, window, maxKeys)
	l.now = c.now
	return l, c
}

func TestAllowBlocksAfterLimitUntilWindowEnds(t *testing.T) {
	l, c := newTest(3, time.Minute, 100)
	for i := 0; i < 3; i++ {
		if _, ok := l.Allow("ip"); !ok {
			t.Fatalf("tentativa %d bloqueada, want liberada", i+1)
		}
	}
	retry, ok := l.Allow("ip")
	if ok {
		t.Fatal("4ª tentativa liberada, want bloqueada")
	}
	if retry != time.Minute {
		t.Errorf("retry = %v, want 1m", retry)
	}

	c.advance(40 * time.Second)
	if retry, ok := l.Allow("ip"); ok || retry != 20*time.Second {
		t.Errorf("no meio da janela: (%v, %v), want (20s, false)", retry, ok)
	}

	c.advance(20 * time.Second)
	if _, ok := l.Allow("ip"); !ok {
		t.Error("janela acabou, want liberada de novo")
	}
}

func TestKeysAreIndependent(t *testing.T) {
	l, _ := newTest(1, time.Minute, 100)
	l.Allow("a")
	if _, ok := l.Allow("a"); ok {
		t.Fatal("a deveria estar bloqueada")
	}
	if _, ok := l.Allow("b"); !ok {
		t.Fatal("b não pode herdar o bloqueio de a")
	}
}

func TestHitBlockedAndReset(t *testing.T) {
	l, c := newTest(2, 15*time.Minute, 100)
	if _, blocked := l.Blocked("x"); blocked {
		t.Fatal("chave nova bloqueada")
	}
	l.Hit("x")
	if _, blocked := l.Blocked("x"); blocked {
		t.Fatal("1 falha de 2 já bloqueia")
	}
	c.advance(time.Minute)
	l.Hit("x")
	retry, blocked := l.Blocked("x")
	if !blocked || retry != 14*time.Minute {
		t.Fatalf("Blocked = (%v, %v), want (14m, true)", retry, blocked)
	}
	// Blocked só consulta: não aumenta a contagem nem estende a janela.
	if retry2, _ := l.Blocked("x"); retry2 != retry {
		t.Errorf("Blocked mudou a janela: %v -> %v", retry, retry2)
	}

	l.Reset("x")
	if _, blocked := l.Blocked("x"); blocked {
		t.Error("Reset não liberou")
	}
}

func TestMemoryIsBounded(t *testing.T) {
	l, c := newTest(1, time.Minute, 10)
	for i := 0; i < 1000; i++ {
		l.Hit(fmt.Sprintf("k%d", i))
		if n := l.Len(); n > 10 {
			t.Fatalf("depois de %d chaves: %d entradas, want <= 10", i+1, n)
		}
	}
	// A mais recente continua contando (quem sai é a que expira primeiro).
	if _, blocked := l.Blocked("k999"); !blocked {
		t.Error("k999 deveria estar bloqueada")
	}

	// Expiradas somem mesmo sem encher o mapa.
	c.advance(2 * time.Minute)
	l.Hit("nova")
	if n := l.Len(); n != 1 {
		t.Errorf("depois da janela: %d entradas, want 1", n)
	}
}

func TestRetryAfterSeconds(t *testing.T) {
	cases := map[time.Duration]string{
		0:                       "1",
		300 * time.Millisecond:  "1",
		time.Second:             "1",
		1500 * time.Millisecond: "2",
		15 * time.Minute:        "900",
	}
	for d, want := range cases {
		if got := RetryAfterSeconds(d); got != want {
			t.Errorf("RetryAfterSeconds(%v) = %q, want %q", d, got, want)
		}
	}
}

func TestReserveIsAtomicUnderConcurrency(t *testing.T) {
	l, _ := newTest(10, 15*time.Minute, 100)
	var granted atomic.Int32
	var wg sync.WaitGroup
	for i := 0; i < 200; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, ok := l.Reserve("conta"); ok {
				granted.Add(1)
			}
		}()
	}
	wg.Wait()
	if got := granted.Load(); got != 10 {
		t.Fatalf("Reserve liberou %d de 200 concorrentes, want exatamente 10", got)
	}
}

func TestUndoGivesTheReservationBack(t *testing.T) {
	l, _ := newTest(2, time.Minute, 100)
	l.Reserve("k")
	l.Reserve("k")
	if _, ok := l.Reserve("k"); ok {
		t.Fatal("3ª reserva liberada, want bloqueada")
	}
	l.Undo("k")
	if _, ok := l.Reserve("k"); !ok {
		t.Fatal("depois do Undo deveria liberar uma")
	}
	// Undo numa chave sem contagem não quebra nem fica negativo.
	l.Undo("nova")
	l.Undo("nova")
	if n := l.Len(); n != 1 {
		t.Errorf("Undo criou entradas: Len = %d, want 1", n)
	}
	l.Undo("k")
	l.Undo("k")
	if n := l.Len(); n != 0 {
		t.Errorf("contagem zerada deveria sair do mapa: Len = %d", n)
	}
}
