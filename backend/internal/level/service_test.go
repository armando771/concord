package level

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"gin-quickstart/backend/internal/call"
)

type fakeStore struct {
	xp map[string]int64
}

func (f *fakeStore) AddVoiceXP(_ context.Context, userID string, xp int64, seconds int64) (int64, int64, error) {
	f.xp[userID] += xp
	return f.xp[userID], 0, nil
}

type fakePublisher struct {
	mu   sync.Mutex
	sent []string // "<alvo> <tipo>"
}

func (f *fakePublisher) record(target string, raw []byte) {
	var event struct {
		Type string `json:"type"`
	}
	_ = json.Unmarshal(raw, &event)
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sent = append(f.sent, target+" "+event.Type)
}

func (f *fakePublisher) SendToUser(userID string, event []byte)      { f.record("user:"+userID, event) }
func (f *fakePublisher) BroadcastToCall(callID string, event []byte) { f.record("call:"+callID, event) }
func (f *fakePublisher) BroadcastToRoom(room string, event []byte)   { f.record(room, event) }

type fakeVoice struct{ active []call.VoiceActivity }

func (f *fakeVoice) ActiveVoiceUsers() []call.VoiceActivity { return f.active }

var t0 = time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)

func newTestService(active ...string) (*Service, *fakeStore, *fakePublisher, *fakeVoice) {
	store := &fakeStore{xp: map[string]int64{}}
	pub := &fakePublisher{}
	voice := &fakeVoice{}
	serverID := "server-1"
	for _, id := range active {
		voice.active = append(voice.active, call.VoiceActivity{UserID: id, CallID: "call-1", ServerID: &serverID, Speaking: true})
	}
	s := &Service{store: store, publisher: pub, voice: voice, pending: map[string]time.Duration{}, lastTick: t0}
	return s, store, pub, voice
}

// run avança o relógio em ticks de 10 s.
func run(s *Service, from time.Time, ticks int) time.Time {
	now := from
	for i := 0; i < ticks; i++ {
		now = now.Add(tickInterval)
		s.tick(context.Background(), now)
	}
	return now
}

func TestXPOnlyForCompleteMinutes(t *testing.T) {
	s, store, _, _ := newTestService("ana")

	now := run(s, t0, 5) // 50 s
	if store.xp["ana"] != 0 {
		t.Fatalf("xp after 50s = %d, want 0", store.xp["ana"])
	}
	run(s, now, 1) // 60 s
	if store.xp["ana"] != XPPerMinute {
		t.Fatalf("xp after 60s = %d, want %d", store.xp["ana"], XPPerMinute)
	}
}

func TestMutingLosesThePartialMinute(t *testing.T) {
	s, store, _, voice := newTestService("ana")

	now := run(s, t0, 5) // 50 s falando
	active := voice.active
	voice.active = nil
	now = run(s, now, 1) // mutou
	voice.active = active
	run(s, now, 5) // mais 50 s

	if store.xp["ana"] != 0 {
		t.Fatalf("xp = %d, want 0 (the 50s before muting must not carry over)", store.xp["ana"])
	}
}

func TestLongPauseDoesNotGrantMissedTime(t *testing.T) {
	s, store, _, _ := newTestService("ana")

	s.tick(context.Background(), t0.Add(10*time.Minute))
	if store.xp["ana"] != 0 {
		t.Fatalf("xp after a 10 min stall = %d, want 0", store.xp["ana"])
	}
}

func TestLevelUpIsBroadcast(t *testing.T) {
	s, store, pub, _ := newTestService("ana")
	store.xp["ana"] = XPToNext(1) - XPPerMinute // falta 1 minuto para o nível 2

	run(s, t0, 6)

	want := map[string]bool{"call:call-1 level:up": false, "server:server-1 level:up": false, "user:ana level:up": false}
	for _, sent := range pub.sent {
		if _, ok := want[sent]; ok {
			want[sent] = true
		}
	}
	for target, seen := range want {
		if !seen {
			t.Errorf("missing %q in %v", target, pub.sent)
		}
	}
}

func TestNoLevelUpEventWithoutNewLevel(t *testing.T) {
	s, _, pub, _ := newTestService("ana")
	run(s, t0, 6)

	for _, sent := range pub.sent {
		if sent != "user:ana level:update" {
			t.Fatalf("unexpected event %q", sent)
		}
	}
}

func TestSilenceDoesNotCountButKeepsProgress(t *testing.T) {
	s, store, _, voice := newTestService("ana")

	now := run(s, t0, 3) // 30 s falando
	voice.active[0].Speaking = false
	now = run(s, now, 30) // 5 min calada, mas desmutada
	if store.xp["ana"] != 0 {
		t.Fatalf("xp while silent = %d, want 0", store.xp["ana"])
	}
	voice.active[0].Speaking = true
	run(s, now, 3) // mais 30 s falando: fecha o minuto
	if store.xp["ana"] != XPPerMinute {
		t.Fatalf("xp = %d, want %d (30s + 30s of voice)", store.xp["ana"], XPPerMinute)
	}
}
