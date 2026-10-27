package music

import (
	"sync"
	"sync/atomic"
	"testing"
)

// Badge DJ: cada música que entra na fila conta para quem pediu.
func TestManagerReportsQueuedSongs(t *testing.T) {
	m, hub := newTestManager(t, true, true)
	var mu sync.Mutex
	got := map[string]int{}
	m.OnQueued(func(userID string, n int) {
		mu.Lock()
		got[userID] += n
		mu.Unlock()
	})

	m.HandleCommand("srv1", "txt", "u1", "/p https://youtu.be/dQw4w9WgXcQ")
	eventually(t, "aviso público", func() bool { return len(hub.publics()) == 1 })
	eventually(t, "contagem", func() bool {
		mu.Lock()
		defer mu.Unlock()
		return len(got) > 0
	})
	mu.Lock()
	defer mu.Unlock()
	if got["u1"] != 1 || len(got) != 1 {
		t.Fatalf("queued = %v, want u1: 1", got)
	}
}

// Pedido recusado (vídeo longo demais) não conta.
func TestManagerRejectedSongIsNotReported(t *testing.T) {
	m, hub := newTestManager(t, true, true)
	var calls atomic.Int32
	m.OnQueued(func(string, int) { calls.Add(1) })
	m.HandleCommand("srv1", "txt", "u1", "/p https://youtu.be/longoxxxxxx")
	if got := waitReply(t, hub); got != TextTooLong {
		t.Fatalf("reply = %q", got)
	}
	if n := calls.Load(); n != 0 {
		t.Fatalf("rejected song reported %d times", n)
	}
}
