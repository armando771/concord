package badge

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"gin-quickstart/backend/internal/call"
)

type fakeStore struct {
	mu      sync.Mutex
	stats   map[string]Stats
	unlocks map[string]Unlocks
	deltas  map[string]Delta
	synced  []string
}

func newFakeStore() *fakeStore {
	return &fakeStore{stats: map[string]Stats{}, unlocks: map[string]Unlocks{}, deltas: map[string]Delta{}}
}

func (f *fakeStore) Stats(_ context.Context, userID string) (Stats, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.synced = append(f.synced, userID)
	s, ok := f.stats[userID]
	if !ok {
		return Stats{}, ErrUserNotFound
	}
	return s, nil
}

func (f *fakeStore) Unlocks(_ context.Context, userID string) (Unlocks, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.unlocks[userID], nil
}

func (f *fakeStore) SaveUnlocks(_ context.Context, userID string, unlocks []Unlock) ([]Unlock, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.unlocks[userID] == nil {
		f.unlocks[userID] = Unlocks{}
	}
	var saved []Unlock
	for _, u := range unlocks {
		if f.unlocks[userID][u.Category] == nil {
			f.unlocks[userID][u.Category] = map[int]time.Time{}
		}
		if _, ok := f.unlocks[userID][u.Category][u.Tier]; ok {
			continue
		}
		f.unlocks[userID][u.Category][u.Tier] = u.At
		saved = append(saved, u)
	}
	return saved, nil
}

func (f *fakeStore) AddCallStats(_ context.Context, userID string, d Delta) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.deltas[userID] = d
	return nil
}

type fakePublisher struct {
	events []UnlockEvent
}

func (f *fakePublisher) SendToUser(userID string, raw []byte) {
	var ev struct {
		Type    string      `json:"type"`
		Payload UnlockEvent `json:"payload"`
	}
	_ = json.Unmarshal(raw, &ev)
	if ev.Type == "badge:unlock" {
		f.events = append(f.events, ev.Payload)
	}
}

type fakeCalls struct{ snaps []call.CallSnapshot }

func (f *fakeCalls) CallSnapshots() []call.CallSnapshot { return f.snaps }

type fakeOnline struct{ ids []string }

func (f *fakeOnline) OnlineUserIDs() []string { return f.ids }

func newTestService() (*Service, *fakeStore, *fakePublisher, *fakeCalls, *fakeOnline) {
	st := newFakeStore()
	pub := &fakePublisher{}
	calls := &fakeCalls{}
	online := &fakeOnline{}
	s := &Service{
		store: st, publisher: pub, calls: calls, online: online,
		now:     func() time.Time { return now },
		tracker: newTracker(t0, time.UTC),
	}
	return s, st, pub, calls, online
}

func TestBadgesAnnouncesNewTiersOnlyOnce(t *testing.T) {
	s, st, pub, _, _ := newTestService()
	// Conta criada no corte: sem Fundador, sem idade.
	st.stats["ana"] = Stats{CreatedAt: FounderCutoff, MessagesSent: 60}

	res, err := s.Badges(context.Background(), "ana")
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Badges) != len(Catalog) || res.UserID != "ana" {
		t.Fatalf("response = %+v", res)
	}
	if len(pub.events) != 1 || len(pub.events[0].Unlocks) != 1 {
		t.Fatalf("events = %+v, want one unlock", pub.events)
	}
	got := pub.events[0].Unlocks[0]
	if got.Category != "mensagens" || got.Tier != 1 || got.TierName != "Puxa-assunto" || got.Rarity != RarityCommon {
		t.Fatalf("unlock = %+v", got)
	}

	if _, err := s.Badges(context.Background(), "ana"); err != nil {
		t.Fatal(err)
	}
	if len(pub.events) != 1 {
		t.Fatalf("second fetch announced again: %+v", pub.events)
	}
}

func TestBadgesUnknownUser(t *testing.T) {
	s, _, _, _, _ := newTestService()
	if _, err := s.Badges(context.Background(), "ghost"); err != ErrUserNotFound {
		t.Fatalf("err = %v, want ErrUserNotFound", err)
	}
}

func TestAnnounceSortsRarestFirst(t *testing.T) {
	s, st, pub, _, _ := newTestService()
	st.stats["ana"] = Stats{CreatedAt: FounderCutoff.Add(-time.Hour), MessagesSent: 60}
	if _, err := s.Badges(context.Background(), "ana"); err != nil {
		t.Fatal(err)
	}
	first := pub.events[0].Unlocks[0]
	if first.Category != "fundador" {
		t.Fatalf("first unlock = %+v, want the legendary Fundador", first)
	}
}

func TestTickFlushesCallStatsAndSyncs(t *testing.T) {
	s, st, _, calls, online := newTestService()
	st.stats["ana"] = Stats{CreatedAt: now}
	st.stats["bia"] = Stats{CreatedAt: now}
	st.stats["caio"] = Stats{CreatedAt: now}
	calls.snaps = []call.CallSnapshot{{
		CallID: "c1", Participants: []string{"ana", "bia"}, Voice: []string{"ana", "bia"}, ScreenSharers: []string{"ana"},
	}}
	online.ids = []string{"caio"}

	at := t0
	for i := 0; i < flushEvery; i++ {
		at = at.Add(tickInterval)
		s.tick(context.Background(), at)
	}
	if d := st.deltas["ana"]; d.Stream != 60 || d.PeakCallSize != 2 || d.LongestSession != 60 {
		t.Fatalf("ana delta = %+v", d)
	}
	synced := map[string]bool{}
	for _, id := range st.synced {
		synced[id] = true
	}
	if !synced["ana"] || !synced["bia"] {
		t.Fatalf("synced = %v, want the people in call", st.synced)
	}
	if synced["caio"] {
		t.Fatalf("caio synced before the online sweep: %v", st.synced)
	}

	st.synced = nil
	for i := flushEvery; i < onlineSweepEvery; i++ {
		at = at.Add(tickInterval)
		s.tick(context.Background(), at)
	}
	found := false
	for _, id := range st.synced {
		found = found || id == "caio"
	}
	if !found {
		t.Fatalf("online sweep did not sync caio: %v", st.synced)
	}
}
