package music

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"sync"
	"testing"
	"time"
)

type sent struct {
	to    string
	event string
	body  map[string]any
}

type fakeHub struct {
	mu     sync.Mutex
	sent   []sent
	public []string
}

func (h *fakeHub) record(to string, raw []byte) {
	var env struct {
		Type    string         `json:"type"`
		Payload map[string]any `json:"payload"`
	}
	_ = json.Unmarshal(raw, &env)
	h.mu.Lock()
	h.sent = append(h.sent, sent{to: to, event: env.Type, body: env.Payload})
	h.mu.Unlock()
}

func (h *fakeHub) last(event string) *sent {
	h.mu.Lock()
	defer h.mu.Unlock()
	for i := len(h.sent) - 1; i >= 0; i-- {
		if h.sent[i].event == event {
			s := h.sent[i]
			return &s
		}
	}
	return nil
}

func (h *fakeHub) publics() []string {
	h.mu.Lock()
	defer h.mu.Unlock()
	return append([]string(nil), h.public...)
}

type mgrSource struct{ fakeSource }

func (s *mgrSource) Resolve(_ context.Context, url string) (Track, error) {
	id := ClassifyArg(url).VideoID
	switch id {
	case "privadoxxxx":
		return Track{}, ErrPrivate
	case "apagadoxxxx":
		return Track{}, ErrUnavailable
	case "aovivoxxxxx":
		return Track{VideoID: id, IsLive: true}, nil
	case "longoxxxxxx":
		return Track{VideoID: id, Title: "Longo", DurationMs: maxVideoMs + 1}, nil
	}
	return Track{VideoID: id, Title: "Bohemian Rhapsody", DurationMs: 355_000}, nil
}

func (s *mgrSource) Search(context.Context, string, int) ([]Track, error) {
	return []Track{{VideoID: "dQw4w9WgXcQ", Title: "Never", DurationMs: 213_000}}, nil
}

func newTestManager(t *testing.T, inVoice bool, enabled bool) (*Manager, *fakeHub) {
	t.Helper()
	hub := &fakeHub{}
	cfg := Config{CacheDir: t.TempDir(), MaxPlayers: 1, QueueMax: 100, IdleTimeout: time.Minute}
	deps := ManagerDeps{
		Locate: func(userID string) (Location, bool) {
			return Location{CallID: "call1", ChannelID: "voz1", ServerID: "srv1"}, inVoice
		},
		Humans:      func(string) []string { return []string{"u1"} },
		BotEnabled:  func(context.Context, string) bool { return enabled },
		ChannelName: func(context.Context, string) string { return "Sala 1" },
		User: func(_ context.Context, id string) (UserRef, error) {
			return UserRef{ID: id, Username: "caio", DisplayName: "Caio"}, nil
		},
		PostPublic: func(_ context.Context, _ string, content string) error {
			hub.mu.Lock()
			hub.public = append(hub.public, content)
			hub.mu.Unlock()
			return nil
		},
		SendToUser:      func(u string, e []byte) { hub.record("user:"+u, e) },
		BroadcastToCall: func(c string, e []byte) { hub.record("call:"+c, e) },
		BroadcastToRoom: func(r string, e []byte) { hub.record(r, e) },
		Source:          &mgrSource{fakeSource{fail: map[string]bool{}}},
		Prepare: func(context.Context, string) (io.ReadCloser, error) {
			return src(30, 0.1), nil
		},
		NewOutput: func(_ context.Context, _, _ string, s FrameSource) (Output, error) {
			return &fakeOutput{src: s, done: make(chan error, 1)}, nil
		},
		Available: func() bool { return true },
	}
	m := NewManager(cfg, deps)
	t.Cleanup(func() { m.OnCallEnded("call1") })
	return m, hub
}

func waitReply(t *testing.T, hub *fakeHub) string {
	t.Helper()
	var text string
	eventually(t, "music:reply", func() bool {
		if s := hub.last("music:reply"); s != nil {
			text, _ = s.body["text"].(string)
			return true
		}
		return false
	})
	return text
}

func TestManagerIgnoresNonCommands(t *testing.T) {
	m, _ := newTestManager(t, true, true)
	if m.HandleCommand("srv1", "txt", "u1", "olá pessoal") {
		t.Fatal("mensagem comum não é comando")
	}
	if !m.HandleCommand("srv1", "txt", "u1", "/help") {
		t.Fatal("/help é comando")
	}
}

func TestManagerHelpAndGuards(t *testing.T) {
	m, hub := newTestManager(t, true, true)
	m.HandleCommand("srv1", "txt", "u1", "/ajuda")
	if got := waitReply(t, hub); got != TextHelp {
		t.Fatalf("help = %q", got)
	}

	m2, hub2 := newTestManager(t, false, true)
	m2.HandleCommand("srv1", "txt", "u1", "/play queen")
	if got := waitReply(t, hub2); got != TextNotInVoice {
		t.Fatalf("fora da voz = %q", got)
	}

	m3, hub3 := newTestManager(t, true, false)
	m3.HandleCommand("srv1", "txt", "u1", "/play queen")
	if got := waitReply(t, hub3); got != TextBotRemoved {
		t.Fatalf("removido = %q", got)
	}
}

func TestManagerPlayRejections(t *testing.T) {
	cases := map[string]string{
		"/play https://open.spotify.com/track/x": TextNotYouTube,
		"/play https://youtu.be/privadoxxxx":     TextPrivate,
		"/play https://youtu.be/apagadoxxxx":     TextVideoGone,
		"/play https://youtu.be/aovivoxxxxx":     TextLive,
		"/play https://youtu.be/longoxxxxxx":     TextTooLong,
		"/skip":                                  TextNothingPlaying,
		"/fila":                                  TextNothingPlaying,
	}
	for cmd, want := range cases {
		m, hub := newTestManager(t, true, true)
		m.HandleCommand("srv1", "txt", "u1", cmd)
		if got := waitReply(t, hub); got != want {
			t.Errorf("%s → %q, want %q", cmd, got, want)
		}
	}
}

func TestManagerPlayPostsPublicAndState(t *testing.T) {
	m, hub := newTestManager(t, true, true)
	m.HandleCommand("srv1", "txt", "u1", "/p https://youtu.be/dQw4w9WgXcQ")
	eventually(t, "aviso público", func() bool { return len(hub.publics()) == 1 })
	if got := hub.publics()[0]; got != TextAddedNow("caio", "Bohemian Rhapsody", 355_000, "Sala 1") {
		t.Fatalf("público = %q", got)
	}
	eventually(t, "music:state", func() bool { return hub.last("music:state") != nil })
	if p := hub.last("music:presence"); p == nil || p.to != "server:srv1" || p.body["active"] != true {
		t.Fatalf("presence = %+v", p)
	}
	if ids := m.Presence("srv1"); len(ids) != 1 || ids[0] != "voz1" {
		t.Fatalf("presence = %v", ids)
	}
}

func TestManagerSearchAndPick(t *testing.T) {
	m, hub := newTestManager(t, true, true)
	m.HandleCommand("srv1", "txt", "u1", "/play never gonna")
	var token string
	eventually(t, "music:search", func() bool {
		if s := hub.last("music:search"); s != nil {
			token, _ = s.body["token"].(string)
			return token != ""
		}
		return false
	})
	if err := m.Pick(context.Background(), "outro", token, 0); err != ErrSearchExpired {
		t.Fatalf("outra pessoa não usa a busca: %v", err)
	}
	if err := m.Pick(context.Background(), "u1", token, 0); err != nil {
		t.Fatal(err)
	}
	eventually(t, "aviso público", func() bool { return len(hub.publics()) == 1 })
	if !strings.Contains(hub.publics()[0], "tocando agora") {
		t.Fatalf("público = %q", hub.publics()[0])
	}
	if err := m.Pick(context.Background(), "u1", token, 0); err != ErrSearchExpired {
		t.Fatalf("busca usada não vale de novo: %v", err)
	}
}

func TestManagerTooManyPlayers(t *testing.T) {
	m, hub := newTestManager(t, true, true)
	m.HandleCommand("srv1", "txt", "u1", "/play https://youtu.be/dQw4w9WgXcQ")
	eventually(t, "1º player", func() bool { return len(m.Presence("srv1")) == 1 })
	m.deps.Locate = func(string) (Location, bool) {
		return Location{CallID: "call2", ChannelID: "voz2", ServerID: "srv1"}, true
	}
	m.HandleCommand("srv1", "txt", "u1", "/play https://youtu.be/dQw4w9WgXcQ")
	if got := waitReply(t, hub); got != TextTooManyPlayers {
		t.Fatalf("got %q", got)
	}
}

func TestManagerCallEndedClosesPlayer(t *testing.T) {
	m, hub := newTestManager(t, true, true)
	m.HandleCommand("srv1", "txt", "u1", "/play https://youtu.be/dQw4w9WgXcQ")
	eventually(t, "player", func() bool { return len(m.Presence("srv1")) == 1 })
	m.OnCallEnded("call1")
	eventually(t, "fechado", func() bool { return len(m.Presence("srv1")) == 0 })
	if s := hub.last("music:state"); s == nil || s.body["closed"] != true {
		t.Fatalf("estado final = %+v", s)
	}
}

func TestManagerConcurrentPlaySharesStartedPlayer(t *testing.T) {
	m, hub := newTestManager(t, true, true)
	release := make(chan struct{})
	var mu sync.Mutex
	calls := 0
	m.deps.NewOutput = func(_ context.Context, _, _ string, s FrameSource) (Output, error) {
		mu.Lock()
		calls++
		mu.Unlock()
		<-release
		return &fakeOutput{src: s, done: make(chan error, 1)}, nil
	}
	m.HandleCommand("srv1", "txt", "u1", "/play https://youtu.be/dQw4w9WgXcQ")
	eventually(t, "1ª conexão", func() bool { mu.Lock(); defer mu.Unlock(); return calls == 1 })
	m.HandleCommand("srv1", "txt", "u1", "/play https://youtu.be/dQw4w9WgXcQ")
	time.Sleep(100 * time.Millisecond)
	if len(m.Presence("srv1")) != 0 {
		t.Fatal("player não iniciado não pode aparecer")
	}
	close(release)
	eventually(t, "2 avisos", func() bool { return len(hub.publics()) == 2 })
	mu.Lock()
	n := calls
	mu.Unlock()
	if n != 1 {
		t.Fatalf("NewOutput chamado %d vezes", n)
	}
	var queued int
	for _, p := range hub.publics() {
		if strings.Contains(p, "posição") {
			queued++
		}
	}
	if queued != 1 || len(m.Presence("srv1")) != 1 {
		t.Fatalf("avisos = %q", hub.publics())
	}
}

func TestManagerStartFailureFailsAllWaiters(t *testing.T) {
	m, hub := newTestManager(t, true, true)
	release := make(chan struct{})
	var mu sync.Mutex
	calls := 0
	m.deps.NewOutput = func(context.Context, string, string, FrameSource) (Output, error) {
		mu.Lock()
		calls++
		mu.Unlock()
		<-release
		return nil, errors.New("livekit fora")
	}
	m.HandleCommand("srv1", "txt", "u1", "/play https://youtu.be/dQw4w9WgXcQ")
	eventually(t, "conexão", func() bool { mu.Lock(); defer mu.Unlock(); return calls == 1 })
	m.HandleCommand("srv1", "txt", "u1", "/play https://youtu.be/dQw4w9WgXcQ")
	time.Sleep(100 * time.Millisecond)
	close(release)
	eventually(t, "2 respostas", func() bool {
		n := 0
		hub.mu.Lock()
		for _, s := range hub.sent {
			if s.event == "music:reply" && s.body["text"] == TextUnavailable {
				n++
			}
		}
		hub.mu.Unlock()
		return n == 2
	})
	if len(hub.publics()) != 0 || len(m.Presence("srv1")) != 0 {
		t.Fatalf("publics=%v presence=%v", hub.publics(), m.Presence("srv1"))
	}
}
