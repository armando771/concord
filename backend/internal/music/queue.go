package music

import "errors"

var (
	ErrQueueFull    = errors.New("fila cheia")
	ErrNotYours     = errors.New("essa música não é sua")
	ErrItemNotFound = errors.New("música não está na fila")
)

// Queue são as próximas músicas (a que está tocando fica no player).
type Queue struct {
	items []*Item
	max   int
}

func NewQueue(max int) *Queue { return &Queue{max: max} }

// Add põe no fim o que couber. firstPos é a posição (1 = próxima) do primeiro.
func (q *Queue) Add(items ...*Item) (added int, firstPos int, err error) {
	free := q.max - len(q.items)
	if free <= 0 {
		return 0, 0, ErrQueueFull
	}
	if len(items) > free {
		items = items[:free]
	}
	firstPos = len(q.items) + 1
	q.items = append(q.items, items...)
	return len(items), firstPos, nil
}

func (q *Queue) Len() int { return len(q.items) }

func (q *Queue) Items() []*Item { return append([]*Item(nil), q.items...) }

func (q *Queue) Head() *Item {
	if len(q.items) == 0 {
		return nil
	}
	return q.items[0]
}

func (q *Queue) PopHead() *Item {
	if len(q.items) == 0 {
		return nil
	}
	it := q.items[0]
	q.items = q.items[1:]
	return it
}

// Take tira da fila o item com esse ID (nil se não estiver).
func (q *Queue) Take(id string) *Item {
	i := q.index(id)
	if i < 0 {
		return nil
	}
	it := q.items[i]
	q.items = append(q.items[:i], q.items[i+1:]...)
	return it
}

func (q *Queue) index(id string) int {
	for i, it := range q.items {
		if it.ID == id {
			return i
		}
	}
	return -1
}

func (q *Queue) Remove(itemID, userID string) (*Item, error) {
	i := q.index(itemID)
	if i < 0 {
		return nil, ErrItemNotFound
	}
	if q.items[i].RequestedBy.ID != userID {
		return nil, ErrNotYours
	}
	it := q.items[i]
	q.items = append(q.items[:i], q.items[i+1:]...)
	return it, nil
}

// Swap troca duas músicas de lugar; as duas têm que ser de quem pede.
func (q *Queue) Swap(a, b, userID string) error {
	i, j := q.index(a), q.index(b)
	if i < 0 || j < 0 {
		return ErrItemNotFound
	}
	if q.items[i].RequestedBy.ID != userID || q.items[j].RequestedBy.ID != userID {
		return ErrNotYours
	}
	q.items[i], q.items[j] = q.items[j], q.items[i]
	return nil
}

func (q *Queue) Clear() []*Item {
	old := q.items
	q.items = nil
	return old
}

// StartsIn estima em quanto tempo o item da posição pos (1 = próxima) começa:
// o resto da atual mais as anteriores, descontando um crossfade por troca.
func StartsIn(nowRemainingMs int64, items []*Item, pos int, crossfadeMs int64) int64 {
	total := nowRemainingMs
	for i := 0; i < pos-1 && i < len(items); i++ {
		total += items[i].Track.DurationMs
	}
	total -= int64(pos) * crossfadeMs
	if total < 0 {
		return 0
	}
	return total
}
