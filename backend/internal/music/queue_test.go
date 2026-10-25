package music

import (
	"errors"
	"testing"
)

func item(id, user string, durMs int64) *Item {
	return &Item{ID: id, Track: Track{Title: id, DurationMs: durMs}, RequestedBy: UserRef{ID: user, Username: user}}
}

func TestQueueAddRespectsMax(t *testing.T) {
	q := NewQueue(3)
	added, pos, err := q.Add(item("a", "ana", 1), item("b", "ana", 1))
	if err != nil || added != 2 || pos != 1 {
		t.Fatalf("added=%d pos=%d err=%v", added, pos, err)
	}
	// Playlist maior que o espaço: entra o que cabe.
	added, pos, err = q.Add(item("c", "bia", 1), item("d", "bia", 1))
	if err != nil || added != 1 || pos != 3 {
		t.Fatalf("added=%d pos=%d err=%v", added, pos, err)
	}
	if _, _, err := q.Add(item("e", "bia", 1)); !errors.Is(err, ErrQueueFull) {
		t.Fatalf("err = %v", err)
	}
}

func TestQueueRemoveOnlyOwn(t *testing.T) {
	q := NewQueue(10)
	q.Add(item("a", "ana", 1), item("b", "bia", 1))
	if _, err := q.Remove("b", "ana"); !errors.Is(err, ErrNotYours) {
		t.Fatalf("err = %v", err)
	}
	if _, err := q.Remove("x", "ana"); !errors.Is(err, ErrItemNotFound) {
		t.Fatalf("err = %v", err)
	}
	if it, err := q.Remove("a", "ana"); err != nil || it.ID != "a" || q.Len() != 1 {
		t.Fatalf("it=%v err=%v len=%d", it, err, q.Len())
	}
}

func TestQueueSwapOnlyOwnPair(t *testing.T) {
	q := NewQueue(10)
	q.Add(item("a1", "ana", 1), item("b1", "bia", 1), item("a2", "ana", 1))
	if err := q.Swap("a1", "b1", "ana"); !errors.Is(err, ErrNotYours) {
		t.Fatalf("err = %v", err)
	}
	if err := q.Swap("a1", "a2", "ana"); err != nil {
		t.Fatal(err)
	}
	ids := []string{}
	for _, it := range q.Items() {
		ids = append(ids, it.ID)
	}
	if ids[0] != "a2" || ids[1] != "b1" || ids[2] != "a1" {
		t.Fatalf("ids = %v", ids)
	}
}

func TestQueueHeadPop(t *testing.T) {
	q := NewQueue(10)
	if q.Head() != nil || q.PopHead() != nil {
		t.Fatal("fila vazia")
	}
	q.Add(item("a", "ana", 1), item("b", "ana", 1))
	if q.Head().ID != "a" || q.PopHead().ID != "a" || q.Head().ID != "b" {
		t.Fatal("ordem errada")
	}
	if len(q.Clear()) != 1 || q.Len() != 0 {
		t.Fatal("clear")
	}
}

func TestStartsIn(t *testing.T) {
	items := []*Item{item("a", "x", 300_000), item("b", "x", 200_000)}
	// Item 1 começa quando a atual termina (menos o crossfade).
	if got := StartsIn(60_000, items, 1, 5_000); got != 55_000 {
		t.Fatalf("pos1 = %d", got)
	}
	// Item 2: resto da atual + item 1, menos dois crossfades.
	if got := StartsIn(60_000, items, 2, 5_000); got != 350_000 {
		t.Fatalf("pos2 = %d", got)
	}
	if got := StartsIn(0, nil, 1, 5_000); got != 0 {
		t.Fatalf("vazio = %d", got)
	}
}
