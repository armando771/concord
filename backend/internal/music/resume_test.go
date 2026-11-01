package music

import (
	"context"
	"io"
	"sync"
	"testing"
	"time"
)

type resumeEnv struct {
	m      *Manager
	hub    *fakeHub
	store  *fakeSessions
	source *mgrSource
	mu     sync.Mutex
	seeks  map[string]time.Duration // arquivo preparado → posição do seek
	humans map[string][]string      // callID → gente na call
}

func (e *resumeEnv) seekOf(path string) (time.Duration, bool) {
	e.mu.Lock()
	defer e.mu.Unlock()
	at, ok := e.seeks[path]
	return at, ok
}

// newResumeEnv: Manager com sessões salvas; a call1 (voz1) tem o u1.
func newResumeEnv(t *testing.T, sessions ...Session) *resumeEnv {
	t.Helper()
	e := &resumeEnv{
		hub: &fakeHub{}, store: newFakeSessions(sessions...),
		source: &mgrSource{fakeSource{fail: map[string]bool{}}},
		seeks:  map[string]time.Duration{},
		humans: map[string][]string{"call1": {"u1"}},
	}
	deps := testDeps(e.hub, true, true)
	deps.Sessions = e.store
	deps.Source = e.source
	deps.Humans = func(callID string) []string {
		e.mu.Lock()
		defer e.mu.Unlock()
		return e.humans[callID]
	}
	deps.Prepare = func(_ context.Context, path string, at time.Duration) (io.ReadCloser, error) {
		e.mu.Lock()
		e.seeks[path] = at
		e.mu.Unlock()
		return src(30, 0.1), nil
	}
	e.m = NewManager(testConfig(t), deps)
	t.Cleanup(func() { e.m.OnCallEnded("call1") })
	return e
}

func savedItem(id, user string) *Item {
	return &Item{ID: id, Track: Track{VideoID: id, Title: "Faixa " + id, DurationMs: 200_000}, RequestedBy: UserRef{ID: user, Username: user}, TextChannelID: "txt"}
}

func savedSession(now *Item, pos time.Duration, queue ...*Item) Session {
	return Session{
		ChannelID: "voz1", ServerID: "srv1", CallID: "call1", TextChannelID: "txt",
		Now: now, Position: pos, Queue: queue, SavedAt: time.Now().Add(-time.Minute),
	}
}

func queueIDs(p *Player) []string {
	var ids []string
	for _, it := range p.Snapshot().Queue {
		ids = append(ids, it.ID)
	}
	return ids
}

func waitPlayer(t *testing.T, m *Manager, channelID string) *Player {
	t.Helper()
	var p *Player
	eventually(t, "player do canal", func() bool { p = m.player(channelID); return p != nil })
	return p
}

// Depois do reinício, a call ainda tem gente: o Maestro volta ao canal e
// continua a faixa da posição salva, com a fila, sem repetir avisos no chat.
func TestResumeRestoresSessionWhenCallHasPeople(t *testing.T) {
	e := newResumeEnv(t, savedSession(savedItem("a", "ana"), 90*time.Second, savedItem("b", "bia")))
	e.m.Resume(context.Background())

	p := waitPlayer(t, e.m, "voz1")
	eventually(t, "a tocando", func() bool { return nowID(p) == "a" })
	if at, ok := e.seekOf(p.deps.CacheDir + "/a.audio"); !ok || at != 90*time.Second {
		t.Fatalf("seek da a = %v (%v), want 90s", at, ok)
	}
	if ids := queueIDs(p); len(ids) != 1 || ids[0] != "b" {
		t.Fatalf("fila = %v", ids)
	}
	if s := p.Snapshot(); s.Now.RequestedBy.ID != "ana" || s.Now.TextChannelID != "txt" {
		t.Fatalf("quem pediu = %+v", s.Now)
	}
	if pres := e.hub.last("music:presence"); pres == nil || pres.body["active"] != true {
		t.Fatalf("presence = %+v", pres)
	}
	if got := e.hub.publics(); len(got) != 0 {
		t.Fatalf("avisos no chat = %v", got)
	}
}

// Call encerrada/vazia, sessão velha, Maestro removido ou nada para tocar:
// a sessão é descartada sem entrar em canal nenhum.
func TestResumeDiscardsUnresumableSessions(t *testing.T) {
	empty := savedSession(savedItem("a", "ana"), time.Second)
	empty.ChannelID, empty.CallID = "voz2", "call2"
	old := savedSession(savedItem("a", "ana"), time.Second)
	old.ChannelID, old.SavedAt = "voz3", time.Now().Add(-sessionMaxAge-time.Minute)
	nothing := savedSession(nil, 0)
	nothing.ChannelID = "voz4"
	e := newResumeEnv(t, empty, old, nothing)
	e.m.Resume(context.Background())

	for _, ch := range []string{"voz2", "voz3", "voz4"} {
		eventually(t, "sessão de "+ch+" descartada", func() bool { return e.store.wasDeleted(ch) })
		if e.m.player(ch) != nil {
			t.Errorf("entrou em %s", ch)
		}
	}
}

func TestResumeDiscardsWhenBotRemoved(t *testing.T) {
	e := newResumeEnv(t, savedSession(savedItem("a", "ana"), time.Second))
	e.m.deps.BotEnabled = func(context.Context, string) bool { return false }
	e.m.Resume(context.Background())
	eventually(t, "sessão descartada", func() bool { return e.store.wasDeleted("voz1") })
	if e.m.player("voz1") != nil {
		t.Fatal("Maestro removido do servidor não pode voltar")
	}
}

// Retomar duas vezes (ou com alguém já tocando no canal) não cria outro
// player nem duplica a fila.
func TestResumeIsIdempotent(t *testing.T) {
	e := newResumeEnv(t, savedSession(savedItem("a", "ana"), time.Second, savedItem("b", "bia")))
	e.m.Resume(context.Background())
	p := waitPlayer(t, e.m, "voz1")
	eventually(t, "a tocando", func() bool { return nowID(p) == "a" })
	e.m.Resume(context.Background())
	if e.m.player("voz1") != p {
		t.Fatal("criou outro player")
	}
	if ids := queueIDs(p); len(ids) != 1 {
		t.Fatalf("fila duplicada: %v", ids)
	}
}

func TestResumeLeavesUserPlayerAlone(t *testing.T) {
	e := newResumeEnv(t, savedSession(savedItem("a", "ana"), time.Second, savedItem("b", "bia")))
	e.m.HandleCommand("srv1", "txt", "u1", "/p https://youtu.be/dQw4w9WgXcQ")
	p := waitPlayer(t, e.m, "voz1")
	eventually(t, "pedido tocando", func() bool { return nowID(p) != "" })
	e.m.Resume(context.Background())
	if s := p.Snapshot(); s.Now.Track.VideoID != "dQw4w9WgXcQ" || len(s.Queue) != 0 {
		t.Fatalf("retomada misturou na fila de quem pediu agora: %+v", s)
	}
}

// A faixa atual não baixa mais (vídeo apagado): pula para a próxima da fila,
// com o aviso de falha que o Maestro já dá.
func TestResumeSkipsTrackThatFails(t *testing.T) {
	e := newResumeEnv(t, savedSession(savedItem("a", "ana"), 30*time.Second, savedItem("b", "bia")))
	e.source.fail["a"] = true
	e.m.Resume(context.Background())
	p := waitPlayer(t, e.m, "voz1")
	eventually(t, "b tocando", func() bool { return nowID(p) == "b" })
	if at, _ := e.seekOf(p.deps.CacheDir + "/b.audio"); at != 0 {
		t.Fatalf("a próxima começa do início, seek = %v", at)
	}
	eventually(t, "aviso de falha", func() bool { return len(e.hub.publics()) == 1 })
	if got := e.hub.publics()[0]; got != TextFailed("Faixa a", "ana", "Sala 1") {
		t.Fatalf("aviso = %q", got)
	}
}

// Desligamento: grava onde cada player estava e a sessão sobrevive ao
// fechamento que vem depois (ffmpeg morto pelo SIGTERM).
func TestShutdownSavesPositionAndKeepsSession(t *testing.T) {
	e := newResumeEnv(t, savedSession(savedItem("a", "ana"), 90*time.Second, savedItem("b", "bia")))
	e.m.Resume(context.Background())
	p := waitPlayer(t, e.m, "voz1")
	eventually(t, "a tocando", func() bool { return nowID(p) == "a" })

	e.m.Shutdown()
	s, ok := e.store.get("voz1")
	if !ok || s.Now == nil || s.Now.ID != "a" || s.Position < 90*time.Second || len(s.Queue) != 1 {
		t.Fatalf("sessão gravada = %+v %v", s, ok)
	}
	p.shutdown(true)
	e.m.OnCallEnded("call1")
	if e.store.wasDeleted("voz1") {
		t.Fatal("o fechamento depois do desligamento apagou a sessão")
	}
	if got := e.hub.publics(); len(got) != 0 {
		t.Fatalf("avisos no desligamento = %v", got)
	}
}

// Tocando normalmente: cada mudança grava a sessão; a call acabar a apaga.
func TestSessionFollowsPlayerAndEndsWithCall(t *testing.T) {
	e := newResumeEnv(t)
	e.m.HandleCommand("srv1", "txt", "u1", "/p https://youtu.be/dQw4w9WgXcQ")
	eventually(t, "sessão gravada", func() bool {
		s, ok := e.store.get("voz1")
		return ok && s.Now != nil && s.Now.Track.VideoID == "dQw4w9WgXcQ" && s.CallID == "call1"
	})
	e.m.OnCallEnded("call1")
	eventually(t, "sessão apagada", func() bool {
		_, ok := e.store.get("voz1")
		return !ok && e.store.wasDeleted("voz1")
	})
}
