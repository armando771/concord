package websocket

import (
	"fmt"
	"sync"
	"testing"
	"time"
)

func TestTTLCacheExpires(t *testing.T) {
	now := time.Unix(0, 0)
	c := newTTLCache[string, int](10, func() time.Time { return now })
	c.Set("a", 1, 45*time.Second)

	if v, ok := c.Get("a"); !ok || v != 1 {
		t.Fatalf("Get = %v %v", v, ok)
	}
	now = now.Add(44 * time.Second)
	if _, ok := c.Get("a"); !ok {
		t.Fatal("ainda dentro do prazo")
	}
	now = now.Add(time.Second)
	if _, ok := c.Get("a"); ok {
		t.Fatal("venceu e continua no cache")
	}
	if c.Len() != 0 {
		t.Fatalf("vencido não é apagado: %d", c.Len())
	}
}

func TestTTLCacheEvictsLeastRecentlyUsed(t *testing.T) {
	now := time.Unix(0, 0)
	c := newTTLCache[string, int](2, func() time.Time { return now })
	c.Set("a", 1, time.Minute)
	c.Set("b", 2, time.Minute)
	c.Get("a") // a é o mais recente
	c.Set("c", 3, time.Minute)

	if _, ok := c.Get("b"); ok {
		t.Fatal("b era o menos usado e devia sair")
	}
	for _, k := range []string{"a", "c"} {
		if _, ok := c.Get(k); !ok {
			t.Fatalf("%s sumiu", k)
		}
	}
	c.Set("a", 10, time.Minute)
	if v, _ := c.Get("a"); v != 10 || c.Len() != 2 {
		t.Fatalf("Set de chave existente troca o valor sem crescer: %v %d", v, c.Len())
	}
}

func TestTTLCacheConcurrent(t *testing.T) {
	c := newTTLCache[string, int](64, time.Now)
	var wg sync.WaitGroup
	for g := 0; g < 8; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			for i := 0; i < 500; i++ {
				k := fmt.Sprint((g*31 + i) % 100)
				c.Set(k, i, time.Minute)
				c.Get(k)
			}
		}(g)
	}
	wg.Wait()
	if c.Len() > 64 {
		t.Fatalf("passou do limite: %d", c.Len())
	}
}
