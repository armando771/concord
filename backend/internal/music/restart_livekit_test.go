package music

import (
	"context"
	"os"
	"sync"
	"testing"
	"time"

	"gin-quickstart/backend/internal/bot"
	"gin-quickstart/backend/internal/platform/livekit"

	"github.com/google/uuid"
	lksdk "github.com/livekit/server-sdk-go/v2"
	"github.com/pion/webrtc/v4"
)

// botWatcher: um ouvinte na sala que conta os pacotes que chegam do Maestro.
type botWatcher struct {
	mu      sync.Mutex
	packets int
}

func (w *botWatcher) count() int {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.packets
}

func (w *botWatcher) onTrack(track *webrtc.TrackRemote, _ *lksdk.RemoteTrackPublication, rp *lksdk.RemoteParticipant) {
	if rp.Identity() != bot.Identity(chA) {
		return
	}
	go func() {
		for {
			if _, _, err := track.ReadRTP(); err != nil {
				return
			}
			w.mu.Lock()
			w.packets++
			w.mu.Unlock()
		}
	}()
}

// Ponta a ponta com LiveKit e ffmpeg de verdade (tons do TestSource): o
// Maestro toca, o "servidor" desliga (Shutdown), um Manager novo retoma da
// sessão salva, o bot volta à sala e a faixa continua de onde parou (o resto
// dela dura o que faltava, não 20 s). Com TEST_DATABASE_URL, as sessões passam
// pelo Postgres. Só roda com MUSIC_LIVEKIT_TEST_URL (ex.: livekit-server --dev).
func TestLiveKitLocalMaestroResumesAfterRestart(t *testing.T) {
	url := os.Getenv("MUSIC_LIVEKIT_TEST_URL")
	if url == "" {
		t.Skip("MUSIC_LIVEKIT_TEST_URL não definido")
	}
	tokens := livekit.NewTokenIssuer(os.Getenv("MUSIC_LIVEKIT_TEST_KEY"), os.Getenv("MUSIC_LIVEKIT_TEST_SECRET"))
	room := uuid.NewString() // a sala do LiveKit é o ID da call
	var store SessionStore = newFakeSessions()
	if os.Getenv("TEST_DATABASE_URL") != "" {
		store = NewSessionRepository(newSessionDB(t))
	}

	w := &botWatcher{}
	cb := lksdk.NewRoomCallback()
	cb.OnTrackSubscribed = w.onTrack
	listenerToken, err := tokens.Issue(room, "listener", "Ouvinte", livekit.Grant{})
	if err != nil {
		t.Fatal(err)
	}
	listener, err := lksdk.ConnectToRoomWithToken(url, listenerToken, cb)
	if err != nil {
		t.Fatalf("ouvinte não conectou: %v", err)
	}
	defer listener.Disconnect()

	cfg := ConfigFromEnv("0")
	cfg.LiveKitURL, cfg.TestSource, cfg.CacheDir, cfg.MaxPlayers = url, true, t.TempDir(), 1
	newManager := func() *Manager {
		hub := &fakeHub{}
		deps := testDeps(hub, true, true)
		deps.Locate = func(string) (Location, bool) {
			return Location{CallID: room, ChannelID: chA, ServerID: srv}, true
		}
		deps.Source, deps.Prepare, deps.NewOutput, deps.Available = nil, nil, nil, nil
		deps.Tokens, deps.Sessions = tokens, store
		return NewManager(cfg, deps)
	}

	first := newManager()
	first.HandleCommand(srv, txt, "u1", "/p https://youtu.be/dQw4w9WgXcQ")
	waitFor(t, 20*time.Second, "o bot tocando para o ouvinte", func() bool { return w.count() > 100 })
	time.Sleep(4 * time.Second) // toca um pedaço da faixa de 20 s

	first.Shutdown()
	list, err := store.List(context.Background())
	if err != nil || len(list) != 1 || list[0].Now == nil || list[0].Position < 4*time.Second {
		t.Fatalf("sessão gravada no desligamento = %+v (%v)", list, err)
	}
	pos := list[0].Position
	waitFor(t, 10*time.Second, "o bot saiu da sala", func() bool {
		return listener.GetParticipantByIdentity(bot.Identity(chA)) == nil
	})

	second := newManager()
	defer func() {
		second.OnCallEnded(room)
		waitFor(t, 5*time.Second, "o bot saiu no fim", func() bool { return second.player(chA) == nil })
		second.sessions.flush(nil) // o apagar da sessão antes de o banco fechar
	}()
	before := w.count()
	second.Resume(context.Background())
	waitFor(t, 20*time.Second, "o bot de volta tocando", func() bool { return w.count() > before+100 })
	p := second.player(chA)
	resumedAt := time.Now()
	if s := p.Snapshot(); s.Now == nil || s.Now.Track.VideoID != "dQw4w9WgXcQ" {
		t.Fatalf("faixa retomada = %+v", s.Now)
	}
	waitFor(t, 25*time.Second, "a faixa terminou", func() bool { return nowID(p) == "" })
	left := time.Since(resumedAt)
	want := 20*time.Second - pos
	t.Logf("parou em %v; o resto tocou %v (faltavam %v)", pos, left, want)
	if left > want+3*time.Second {
		t.Fatalf("o resto tocou %v, mas faltavam %v: a retomada voltou do começo", left, want)
	}
}

func waitFor(t *testing.T, limit time.Duration, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(limit)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatalf("timeout esperando: %s", what)
}
