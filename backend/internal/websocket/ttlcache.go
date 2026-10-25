package websocket

import (
	"container/list"
	"sync"
	"time"
)

// ttlCache é um LRU limitado em que cada entrada vence sozinha. Seguro para
// várias goroutines.
type ttlCache[K comparable, V any] struct {
	mu    sync.Mutex
	max   int
	now   func() time.Time
	order *list.List // frente = usado mais recentemente
	items map[K]*list.Element
}

type ttlEntry[K comparable, V any] struct {
	key     K
	value   V
	expires time.Time
}

func newTTLCache[K comparable, V any](max int, now func() time.Time) *ttlCache[K, V] {
	return &ttlCache[K, V]{max: max, now: now, order: list.New(), items: make(map[K]*list.Element)}
}

func (c *ttlCache[K, V]) Get(key K) (V, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	var zero V
	el, ok := c.items[key]
	if !ok {
		return zero, false
	}
	entry := el.Value.(*ttlEntry[K, V])
	if !c.now().Before(entry.expires) {
		c.order.Remove(el)
		delete(c.items, key)
		return zero, false
	}
	c.order.MoveToFront(el)
	return entry.value, true
}

func (c *ttlCache[K, V]) Set(key K, value V, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	expires := c.now().Add(ttl)
	if el, ok := c.items[key]; ok {
		entry := el.Value.(*ttlEntry[K, V])
		entry.value, entry.expires = value, expires
		c.order.MoveToFront(el)
		return
	}
	c.items[key] = c.order.PushFront(&ttlEntry[K, V]{key: key, value: value, expires: expires})
	for c.order.Len() > c.max {
		oldest := c.order.Back()
		c.order.Remove(oldest)
		delete(c.items, oldest.Value.(*ttlEntry[K, V]).key)
	}
}

func (c *ttlCache[K, V]) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.order.Len()
}
