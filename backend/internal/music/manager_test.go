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
	m := NewManager(testConfig(t), testDeps(hub, inVoice, enabled))
	t.Cleanup(func() { m.OnCallEnded("call1") })
	return m, hub
}

func testConfig(t *testing.T) Config {
	return Config{CacheDir: t.TempDir(), MaxPlayers: 1, QueueMax: 100, IdleTimeout: time.Minute}
}

// testDeps: um usuário (u1) na voz1 da call1 do srv1, tudo em memória.
func testDeps(hub *fakeHub, inVoice bool, enabled bool) ManagerDeps {
	return ManagerDeps{
		Locate: func(userID string) (Location, bool) {
			return Location{CallID: "call1", ChannelID: "voz1", ServerID: "srv1"}, inVoice
		},
		Humans:      func(string) []string { return []string{"u1"} },
		IsMember:    func(context.Context, string, string) bool { return true },
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
		Prepare: func(context.Context, string, time.Duration) (io.ReadCloser, error) {
			return src(30, 0.1), nil
		},
		NewOutput: func(_ context.Context, _, _ string, s FrameSource) (Output, error) {
			return &fakeOutput{src: s, done: make(chan error, 1)}, nil
		},
		Available: func() bool { return true },
	}
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
	m.HandleCommand("srv1", "txt", "u2", "/play https://youtu.be/dQw4w9WgXcQ")
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
	// O estado "closed" sai logo depois de a presença zerar: espera por ele
	// em vez de olhar o último evento no mesmo instante (falhava sob carga).
	eventually(t, "estado fechado", func() bool {
		s := hub.last("music:state")
		return s != nil && s.body["closed"] == true
	})
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
	m.HandleCommand("srv1", "txt", "u2", "/play https://youtu.be/dQw4w9WgXcQ")
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
	m.HandleCommand("srv1", "txt", "u2", "/play https://youtu.be/dQw4w9WgXcQ")
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

func TestManagerThrottlesOneCommandPerUser(t *testing.T) {
	m, hub := newTestManager(t, true, true)
	release := make(chan struct{})
	resolves := 0
	var mu sync.Mutex
	m.deps.Source = &blockingSource{mgrSource: mgrSource{fakeSource{fail: map[string]bool{}}}, release: release, mu: &mu, n: &resolves}
	if !m.HandleCommand("srv1", "txt", "u1", "/play https://youtu.be/dQw4w9WgXcQ") {
		t.Fatal("comando")
	}
	eventually(t, "resolve em andamento", func() bool { mu.Lock(); defer mu.Unlock(); return resolves == 1 })
	// O 2º do mesmo usuário é comando (não vira mensagem) mas não dispara trabalho.
	if !m.HandleCommand("srv1", "txt", "u1", "/play https://youtu.be/dQw4w9WgXcQ") {
		t.Fatal("ainda é comando")
	}
	time.Sleep(100 * time.Millisecond)
	mu.Lock()
	if resolves != 1 {
		mu.Unlock()
		t.Fatalf("resolves = %d, want 1", resolves)
	}
	mu.Unlock()
	close(release)
	eventually(t, "aviso", func() bool { return len(hub.publics()) == 1 })
	eventually(t, "livre de novo", func() bool {
		m.mu.Lock()
		defer m.mu.Unlock()
		return len(m.busy) == 0
	})
	time.Sleep(50 * time.Millisecond)
	if len(hub.publics()) != 1 {
		t.Fatalf("publics = %v", hub.publics())
	}
}

type blockingSource struct {
	mgrSource
	release chan struct{}
	mu      *sync.Mutex
	n       *int
}

func (s *blockingSource) Resolve(ctx context.Context, url string) (Track, error) {
	s.mu.Lock()
	*s.n++
	s.mu.Unlock()
	<-s.release
	return s.mgrSource.Resolve(ctx, url)
}

type panicSource struct{ mgrSource }

func (*panicSource) Resolve(context.Context, string) (Track, error) { panic("boom") }

func TestManagerCommandPanicIsRecovered(t *testing.T) {
	m, hub := newTestManager(t, true, true)
	m.deps.Source = &panicSource{mgrSource{fakeSource{fail: map[string]bool{}}}}
	m.HandleCommand("srv1", "txt", "u1", "/play https://youtu.be/dQw4w9WgXcQ")
	eventually(t, "usuário liberado após o pânico", func() bool {
		m.mu.Lock()
		defer m.mu.Unlock()
		return len(m.busy) == 0
	})
	// O manager segue vivo e atende o próximo comando do mesmo usuário.
	m.HandleCommand("srv1", "txt", "u1", "/ajuda")
	if got := waitReply(t, hub); got != TextHelp {
		t.Fatalf("depois do pânico = %q", got)
	}
}

func TestManagerPrunesExpiredSearches(t *testing.T) {
	m, hub := newTestManager(t, true, true)
	m.mu.Lock()
	m.searches["velha"] = searchSession{userID: "x", expires: time.Now().Add(-time.Second)}
	m.searches["valida"] = searchSession{userID: "x", expires: time.Now().Add(time.Minute)}
	m.mu.Unlock()
	m.HandleCommand("srv1", "txt", "u1", "/play never gonna")
	eventually(t, "music:search", func() bool { return hub.last("music:search") != nil })
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.searches["velha"]; ok {
		t.Fatal("busca vencida deveria ter sido removida")
	}
	if _, ok := m.searches["valida"]; !ok {
		t.Fatal("busca válida não pode ser removida")
	}
}

func TestManagerPresenceRequiresMembership(t *testing.T) {
	m, _ := newTestManager(t, true, true)
	m.HandleCommand("srv1", "txt", "u1", "/play https://youtu.be/dQw4w9WgXcQ")
	eventually(t, "player", func() bool { return len(m.Presence("srv1")) == 1 })
	if ids, ok := m.PresenceFor(context.Background(), "u1", "srv1"); !ok || len(ids) != 1 {
		t.Fatalf("membro: %v %v", ids, ok)
	}
	m.deps.IsMember = func(context.Context, string, string) bool { return false }
	if _, ok := m.PresenceFor(context.Background(), "intruso", "srv1"); ok {
		t.Fatal("não-membro não pode listar a presença")
	}
	m.deps.IsMember = nil
	if _, ok := m.PresenceFor(context.Background(), "u1", "srv1"); ok {
		t.Fatal("sem checagem configurada, nega")
	}
}

func TestManagerCloseServerStopsPlayers(t *testing.T) {
	m, hub := newTestManager(t, true, true)
	m.HandleCommand("srv1", "txt", "u1", "/play https://youtu.be/dQw4w9WgXcQ")
	eventually(t, "player", func() bool { return len(m.Presence("srv1")) == 1 })
	m.CloseServer("outro-servidor")
	time.Sleep(50 * time.Millisecond)
	if len(m.Presence("srv1")) != 1 {
		t.Fatal("outro servidor não pode fechar este player")
	}
	m.CloseServer("srv1")
	eventually(t, "fechado", func() bool { return len(m.Presence("srv1")) == 0 })
	if s := hub.last("music:state"); s == nil || s.body["closed"] != true {
		t.Fatalf("estado final = %+v", s)
	}
}

func TestManagerUserLookupFailureArmsIdle(t *testing.T) {
	m, hub := newTestManager(t, true, true)
	m.cfg.IdleTimeout = 50 * time.Millisecond
	m.deps.User = func(context.Context, string) (UserRef, error) { return UserRef{}, errors.New("banco fora") }
	m.HandleCommand("srv1", "txt", "u1", "/play https://youtu.be/dQw4w9WgXcQ")
	if got := waitReply(t, hub); got != TextUnavailable {
		t.Fatalf("got %q", got)
	}
	eventually(t, "player ocioso fechado", func() bool { return len(m.Presence("srv1")) == 0 })
}

func TestManagerPlayerClosedBeforeInsertionIsNotKept(t *testing.T) {
	m, _ := newTestManager(t, true, true)
	// A saída já nasce encerrada: o player cai logo após o Start.
	m.deps.NewOutput = func(_ context.Context, _, _ string, s FrameSource) (Output, error) {
		o := &fakeOutput{src: s, done: make(chan error, 1)}
		close(o.done)
		return o, nil
	}
	loc := Location{CallID: "call1", ChannelID: "voz1", ServerID: "srv1"}
	for i := 0; i < 20; i++ {
		_, _ = m.playerFor(context.Background(), loc) // pode ter dado certo: o player cai logo depois
		eventually(t, "sem entrada morta", func() bool { return m.player("voz1") == nil })
	}
}
