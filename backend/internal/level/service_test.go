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
	mu     sync.Mutex
	sent   []string // "<alvo> <tipo>"
	boosts []BoostEvent
}

func (f *fakePublisher) record(target string, raw []byte) {
	var event struct {
		Type    string          `json:"type"`
		Payload json.RawMessage `json:"payload"`
	}
	_ = json.Unmarshal(raw, &event)
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sent = append(f.sent, target+" "+event.Type)
	if event.Type == "voice:boost" {
		var boost BoostEvent
		_ = json.Unmarshal(event.Payload, &boost)
		f.boosts = append(f.boosts, boost)
	}
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
		voice.active = append(voice.active, call.VoiceActivity{UserID: id, CallID: "call-1", ServerID: &serverID})
	}
	s := &Service{store: store, publisher: pub, voice: voice, pending: map[string]time.Duration{}, lastBoost: map[string]int{}, lastTick: t0}
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

// usersN devolve n nomes distintos ("ua", "ub"...).
func usersN(n int) []string {
	names := make([]string, n)
	for i := range names {
		names[i] = "u" + string(rune('a'+i))
	}
	return names
}

func TestBoostMultipliesXP(t *testing.T) {
	cases := []struct {
		users int
		want  int64
	}{
		{3, XPPerMinute},              // sem buff
		{4, XPPerMinute * 125 / 100},  // A
		{6, XPPerMinute * 150 / 100},  // S
		{8, XPPerMinute * 175 / 100},  // SS
		{10, XPPerMinute * 200 / 100}, // SSS
	}
	for _, c := range cases {
		s, store, _, _ := newTestService(usersN(c.users)...)
		run(s, t0, 6) // 60 s = 1 minuto
		for _, name := range usersN(c.users) {
			if store.xp[name] != c.want {
				t.Errorf("%d pessoas: xp de %s = %d, want %d", c.users, name, store.xp[name], c.want)
			}
		}
	}
}

func TestBoostEventOnlyWhenBuffed(t *testing.T) {
	s, _, pub, _ := newTestService(usersN(3)...)
	run(s, t0, 6)

	if len(pub.boosts) != 0 {
		t.Fatalf("call sem buff recebeu voice:boost: %+v", pub.boosts)
	}
}

func TestBoostEventIsHeartbeatWhileBuffed(t *testing.T) {
	s, _, pub, _ := newTestService(usersN(4)...)
	run(s, t0, 3)

	if len(pub.boosts) != 3 {
		t.Fatalf("boosts = %d, want 1 por tick (3)", len(pub.boosts))
	}
	want := BoostEvent{CallID: "call-1", Percent: 125, Eligible: 4}
	for _, got := range pub.boosts {
		if got != want {
			t.Errorf("boost = %+v, want %+v", got, want)
		}
	}
}

func TestBoostEndIsAnnouncedOnce(t *testing.T) {
	s, _, pub, voice := newTestService(usersN(4)...)
	now := run(s, t0, 1)

	voice.active = voice.active[:3] // alguém mutou: sobram 3
	now = run(s, now, 1)
	run(s, now, 2) // sem buff: nada mais é enviado

	last := pub.boosts[len(pub.boosts)-1]
	if len(pub.boosts) != 2 || last.Percent != 100 || last.Eligible != 3 {
		t.Fatalf("boosts = %+v, want buff (125) e depois um único aviso de fim (100, 3 elegíveis)", pub.boosts)
	}
}

func TestBoostEndIsAnnouncedWhenCallDisappears(t *testing.T) {
	s, _, pub, voice := newTestService(usersN(4)...)
	now := run(s, t0, 1)

	voice.active = nil // todo mundo saiu/mutou
	run(s, now, 2)

	last := pub.boosts[len(pub.boosts)-1]
	if len(pub.boosts) != 2 || last != (BoostEvent{CallID: "call-1", Percent: 100}) {
		t.Fatalf("boosts = %+v, want buff e depois um único aviso de fim", pub.boosts)
	}
}
