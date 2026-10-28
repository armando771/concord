package music

import (
	"slices"
	"sync"
	"testing"
	"time"
)

// Badge DJ: a música conta para quem pediu quando toca o tempo mínimo.
func TestPlayerCreditsSongThatPlayedLongEnough(t *testing.T) {
	h := newHarnessPlayed(t, 30, time.Minute, 20*time.Millisecond)
	h.p.Enqueue([]*Item{req("a", "ana")}, "txt")
	eventually(t, "a contada", func() bool { return len(h.n.allPlayed()) == 1 })
	if got := h.n.allPlayed(); got[0] != "call1:ana" {
		t.Fatalf("played = %v, want call1:ana", got)
	}
}

// Pulada, terminada antes do tempo ou com o player fechado: não conta.
func TestPlayerCreditPlayedOnlyWhileStillPlaying(t *testing.T) {
	cases := []struct {
		name  string
		setup func(p *Player, it *Item)
	}{
		{"pulada", func(p *Player, it *Item) { p.skipped = it.ID }},
		{"outra tocando", func(p *Player, _ *Item) { p.now = req("b", "bia") }},
		{"terminou", func(p *Player, _ *Item) { p.now = nil }},
		{"player fechado", func(p *Player, _ *Item) { p.closed = true }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			n := &fakeNotifier{}
			p := NewPlayer("call1", "ch1", "srv1", "Sala 1", PlayerDeps{Notify: n})
			it := req("a", "ana")
			p.now = it
			tc.setup(p, it)
			p.creditPlayed(it)
			if got := n.allPlayed(); len(got) != 0 {
				t.Fatalf("played = %v, want nada", got)
			}
		})
	}
	n := &fakeNotifier{}
	p := NewPlayer("call1", "ch1", "srv1", "Sala 1", PlayerDeps{Notify: n})
	it := req("a", "ana")
	p.now = it
	p.creditPlayed(it)
	if got := n.allPlayed(); !slices.Equal(got, []string{"call1:ana"}) {
		t.Fatalf("tocando: played = %v", got)
	}
}

// O manager só conta no DJ se alguém além de quem pediu estava ouvindo.
func TestNotifierPlayedNeedsSomeoneElseListening(t *testing.T) {
	cases := []struct {
		name      string
		listeners func(string) []string
		want      []string
	}{
		{"ninguém na call", func(string) []string { return nil }, nil},
		{"só quem pediu", func(string) []string { return []string{"u1"} }, nil},
		{"mais alguém ouvindo", func(string) []string { return []string{"u1", "u2"} }, []string{"u1"}},
		{"quem pediu fora da call", func(string) []string { return []string{"u2"} }, []string{"u1"}},
		{"sem fonte de ouvintes", nil, nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			m := NewManager(Config{}, ManagerDeps{Listeners: tc.listeners, Available: func() bool { return false }})
			var mu sync.Mutex
			var got []string
			m.OnPlayed(func(userID string) {
				mu.Lock()
				got = append(got, userID)
				mu.Unlock()
			})
			(*notifier)(m).Played("call1", "u1")
			mu.Lock()
			defer mu.Unlock()
			if !slices.Equal(got, tc.want) {
				t.Fatalf("contados = %v, want %v", got, tc.want)
			}
		})
	}
}

// Pôr na fila não conta mais no DJ (uma playlist de 5000 dava o tier máximo).
func TestManagerQueueAloneIsNotCounted(t *testing.T) {
	m, hub := newTestManager(t, true, true)
	var mu sync.Mutex
	var got []string
	m.OnPlayed(func(userID string) {
		mu.Lock()
		got = append(got, userID)
		mu.Unlock()
	})
	m.HandleCommand("srv1", "txt", "u1", "/p https://youtu.be/dQw4w9WgXcQ")
	eventually(t, "aviso público", func() bool { return len(hub.publics()) == 1 })
	mu.Lock()
	defer mu.Unlock()
	if len(got) != 0 {
		t.Fatalf("contados ao pôr na fila = %v", got)
	}
}
