// Package ratelimit conta eventos por chave (IP, identificador de login) numa
// janela fixa, em memória e com tamanho limitado.
package ratelimit

import (
	"strconv"
	"sync"
	"time"
)

type entry struct {
	count   int
	resetAt time.Time
}

// Limiter: no máximo limit eventos por chave a cada window, contados a partir
// do primeiro evento da janela. Guarda no máximo maxKeys chaves; as expiradas
// são varridas sozinhas e, com o mapa cheio, sai a que expira primeiro.
type Limiter struct {
	mu        sync.Mutex
	limit     int
	window    time.Duration
	maxKeys   int
	entries   map[string]*entry
	lastSweep time.Time
	now       func() time.Time
}

func New(limit int, window time.Duration, maxKeys int) *Limiter {
	return &Limiter{
		limit:   limit,
		window:  window,
		maxKeys: maxKeys,
		entries: make(map[string]*entry),
		now:     time.Now,
	}
}

// SetClock troca o relógio (para testes).
func (l *Limiter) SetClock(now func() time.Time) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.now = now
}

// Allow conta um evento para key, a menos que ela já esteja no limite.
// Bloqueada, devolve quanto falta para liberar e false.
func (l *Limiter) Allow(key string) (time.Duration, bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	if retry, blocked := l.blocked(key, now); blocked {
		return retry, false
	}
	l.hit(key, now)
	return 0, true
}

// Blocked diz se key está no limite (sem contar nada) e quanto falta.
func (l *Limiter) Blocked(key string) (time.Duration, bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.blocked(key, l.now())
}

// Hit conta um evento para key (ex.: uma senha errada).
func (l *Limiter) Hit(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.hit(key, l.now())
}

// Reset zera a contagem de key (ex.: login certo).
func (l *Limiter) Reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.entries, key)
}

// Len é o número de chaves guardadas (para testes e diagnóstico).
func (l *Limiter) Len() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.entries)
}

func (l *Limiter) blocked(key string, now time.Time) (time.Duration, bool) {
	e, ok := l.entries[key]
	if !ok || !now.Before(e.resetAt) || e.count < l.limit {
		return 0, false
	}
	return e.resetAt.Sub(now), true
}

func (l *Limiter) hit(key string, now time.Time) {
	if now.Sub(l.lastSweep) >= l.window {
		l.sweep(now)
	}
	e, ok := l.entries[key]
	if ok && now.Before(e.resetAt) {
		e.count++
		return
	}
	if !ok && len(l.entries) >= l.maxKeys {
		l.sweep(now)
		if len(l.entries) >= l.maxKeys {
			l.evictOldest()
		}
	}
	l.entries[key] = &entry{count: 1, resetAt: now.Add(l.window)}
}

func (l *Limiter) sweep(now time.Time) {
	for k, e := range l.entries {
		if !now.Before(e.resetAt) {
			delete(l.entries, k)
		}
	}
	l.lastSweep = now
}

func (l *Limiter) evictOldest() {
	var oldestKey string
	var oldest time.Time
	found := false
	for k, e := range l.entries {
		if !found || e.resetAt.Before(oldest) {
			oldestKey, oldest, found = k, e.resetAt, true
		}
	}
	delete(l.entries, oldestKey)
}

// RetryAfterSeconds formata d para o cabeçalho Retry-After: segundos inteiros,
// arredondando para cima, no mínimo 1.
func RetryAfterSeconds(d time.Duration) string {
	secs := int64((d + time.Second - 1) / time.Second)
	if secs < 1 {
		secs = 1
	}
	return strconv.FormatInt(secs, 10)
}
