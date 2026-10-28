package music

import (
	"context"
	"errors"
	"io"
	"strings"
	"sync"
	"testing"
	"time"
)

type fakeSource struct {
	mu   sync.Mutex
	fail map[string]bool
}

func (f *fakeSource) Resolve(context.Context, string) (Track, error) { return Track{}, nil }
func (f *fakeSource) Search(context.Context, string, int) ([]Track, error) {
	return nil, nil
}
func (f *fakeSource) Playlist(context.Context, string, int) (string, []Track, error) {
	return "", nil, nil
}
func (f *fakeSource) DownloadAudio(_ context.Context, id, dir string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.fail[id] {
		return "", ErrUnavailable
	}
	return dir + "/" + id + ".audio", nil
}
func (f *fakeSource) DownloadVideo(_ context.Context, id, dir string) (string, error) {
	return dir + "/" + id + ".video", nil
}

type fakeOutput struct {
	src  FrameSource
	done chan error
}

func (o *fakeOutput) Done() <-chan error { return o.done }
func (o *fakeOutput) Close()             {}

type fakeNotifier struct {
	mu      sync.Mutex
	publics []string
	humans  []string
	closed  int
	states  int
	// Músicas que tocaram o bastante ("call:quem pediu"), badge DJ.
	played []string
}

func (n *fakeNotifier) PublishState(*Player) { n.mu.Lock(); n.states++; n.mu.Unlock() }
func (n *fakeNotifier) Public(_ string, c string) {
	n.mu.Lock()
	n.publics = append(n.publics, c)
	n.mu.Unlock()
}
func (n *fakeNotifier) Humans(string) []string {
	n.mu.Lock()
	defer n.mu.Unlock()
	return append([]string(nil), n.humans...)
}
func (n *fakeNotifier) Closed(*Player) { n.mu.Lock(); n.closed++; n.mu.Unlock() }
func (n *fakeNotifier) Played(callID, userID string) {
	n.mu.Lock()
	n.played = append(n.played, callID+":"+userID)
	n.mu.Unlock()
}
func (n *fakeNotifier) allPlayed() []string {
	n.mu.Lock()
	defer n.mu.Unlock()
	return append([]string(nil), n.played...)
}
func (n *fakeNotifier) setHumans(h []string) {
	n.mu.Lock()
	n.humans = h
	n.mu.Unlock()
}
func (n *fakeNotifier) allPublics() []string {
	n.mu.Lock()
	defer n.mu.Unlock()
	return append([]string(nil), n.publics...)
}
func (n *fakeNotifier) lastPublic() string {
	n.mu.Lock()
	defer n.mu.Unlock()
	if len(n.publics) == 0 {
		return ""
	}
	return n.publics[len(n.publics)-1]
}

type harness struct {
	p   *Player
	out *fakeOutput
	n   *fakeNotifier
	src *fakeSource
}

// Cada faixa dura `secs` segundos de PCM constante.
func newHarness(t *testing.T, secs float64, idle time.Duration) *harness {
	t.Helper()
	return newHarnessPlayed(t, secs, idle, time.Hour)
}

// newHarnessPlayed: played é quanto a música toca até contar no DJ.
func newHarnessPlayed(t *testing.T, secs float64, idle, played time.Duration) *harness {
	t.Helper()
	h := &harness{n: &fakeNotifier{humans: []string{"ana"}}, src: &fakeSource{fail: map[string]bool{}}}
	deps := PlayerDeps{
		Source: h.src,
		Prepare: func(context.Context, string) (io.ReadCloser, error) {
			return src(secs, 0.3), nil
		},
		NewOutput: func(_ context.Context, _, _ string, s FrameSource) (Output, error) {
			h.out = &fakeOutput{src: s, done: make(chan error, 1)}
			return h.out, nil
		},
		Notify:      h.n,
		Now:         time.Now,
		CacheDir:    t.TempDir(),
		QueueMax:    3,
		IdleTimeout: idle,
		Crossfade:   200 * time.Millisecond,
		SkipFade:    40 * time.Millisecond,
		PlayedAfter: played,
	}
	h.p = NewPlayer("call1", "ch1", "srv1", "Sala 1", deps)
	if err := h.p.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(h.p.Close)
	return h
}

// pull simula o encoder pedindo n frames.
func (h *harness) pull(n int) {
	buf := make([]float32, FrameLen)
	for i := 0; i < n; i++ {
		h.out.src.ReadFrame(buf)
	}
}

func eventually(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("timeout esperando: %s", what)
}

func req(id, user string) *Item {
	return &Item{ID: id, Track: Track{VideoID: id, Title: strings.ToUpper(id), DurationMs: 1000}, RequestedBy: UserRef{ID: user, Username: user}}
}

func nowID(p *Player) string {
	s := p.Snapshot()
	if s.Now == nil {
		return ""
	}
	return s.Now.ID
}

func TestPlayerPlaysQueueInOrder(t *testing.T) {
	h := newHarness(t, 1, time.Minute)
	res, err := h.p.Enqueue([]*Item{req("a", "ana")}, "txt")
	if err != nil || !res.StartsNow || res.FirstPos != 1 {
		t.Fatalf("res=%+v err=%v", res, err)
	}
	eventually(t, "a tocando", func() bool { return nowID(h.p) == "a" })

	res, _ = h.p.Enqueue([]*Item{req("b", "ana")}, "txt")
	if res.StartsNow || res.FirstPos != 1 {
		t.Fatalf("b: %+v", res)
	}
	// 1 s = 50 frames; o crossfade de 200 ms começa perto do frame 40.
	eventually(t, "b tocando", func() bool { h.pull(5); return nowID(h.p) == "b" })
}

func TestPlayerSkipByRequester(t *testing.T) {
	h := newHarness(t, 30, time.Minute)
	h.p.Enqueue([]*Item{req("a", "ana")}, "txt")
	eventually(t, "a tocando", func() bool { return nowID(h.p) == "a" })
	if r := h.p.Skip("ana"); r.Kind != SkipDone {
		t.Fatalf("r = %+v", r)
	}
	if got := h.n.lastPublic(); got != TextSkippedBy("A", "ana", "Sala 1") {
		t.Fatalf("public = %q", got)
	}
	eventually(t, "a terminou", func() bool { h.pull(5); return nowID(h.p) == "" })
}

func TestPlayerSkipVotes(t *testing.T) {
	h := newHarness(t, 30, time.Minute)
	h.n.setHumans([]string{"ana", "bia", "caio"})
	h.p.Enqueue([]*Item{req("a", "ana")}, "txt")
	eventually(t, "a tocando", func() bool { return nowID(h.p) == "a" })

	if r := h.p.Skip("bia"); r.Kind != SkipVoted || r.Votes != 1 || r.Needed != 2 {
		t.Fatalf("bia: %+v", r)
	}
	if r := h.p.Skip("bia"); r.Kind != SkipAlready {
		t.Fatalf("bia de novo: %+v", r)
	}
	if r := h.p.Skip("caio"); r.Kind != SkipDone {
		t.Fatalf("caio: %+v", r)
	}
	if got := h.n.lastPublic(); got != TextSkippedByVote("A", 2, 2, "Sala 1") {
		t.Fatalf("public = %q", got)
	}
}

func TestPlayerSkipWhenVotersReachHalfAfterLeave(t *testing.T) {
	h := newHarness(t, 30, time.Minute)
	h.n.setHumans([]string{"ana", "bia", "caio", "davi"})
	h.p.Enqueue([]*Item{req("a", "ana")}, "txt")
	eventually(t, "a tocando", func() bool { return nowID(h.p) == "a" })
	h.p.Skip("bia") // 1/2
	h.n.setHumans([]string{"ana", "bia"})
	h.p.ParticipantLeft("caio")
	if !strings.Contains(h.n.lastPublic(), "foi pulada por votação (1/1)") {
		t.Fatalf("public = %q", h.n.lastPublic())
	}
}

func TestPlayerNothingPlaying(t *testing.T) {
	h := newHarness(t, 1, time.Minute)
	if r := h.p.Skip("ana"); r.Kind != SkipNothing {
		t.Fatalf("r = %+v", r)
	}
}

func TestPlayerRemoveAndSwapOnlyOwn(t *testing.T) {
	h := newHarness(t, 30, time.Minute)
	h.p.Enqueue([]*Item{req("a", "ana")}, "txt")
	eventually(t, "a tocando", func() bool { return nowID(h.p) == "a" })
	h.p.Enqueue([]*Item{req("b", "bia"), req("c", "ana")}, "txt")
	if err := h.p.Remove("b", "ana"); !errors.Is(err, ErrNotYours) {
		t.Fatalf("err = %v", err)
	}
	if err := h.p.Swap("b", "c", "ana"); !errors.Is(err, ErrNotYours) {
		t.Fatalf("err = %v", err)
	}
	if err := h.p.Remove("c", "ana"); err != nil {
		t.Fatal(err)
	}
	if q := h.p.Snapshot().Queue; len(q) != 1 || q[0].ID != "b" {
		t.Fatalf("fila = %+v", q)
	}
}

func TestPlayerQueueFull(t *testing.T) {
	h := newHarness(t, 30, time.Minute)
	h.p.Enqueue([]*Item{req("a", "ana")}, "txt")
	eventually(t, "a tocando", func() bool { return nowID(h.p) == "a" })
	h.p.Enqueue([]*Item{req("b", "ana"), req("c", "ana"), req("d", "ana")}, "txt")
	if _, err := h.p.Enqueue([]*Item{req("e", "ana")}, "txt"); !errors.Is(err, ErrQueueFull) {
		t.Fatalf("err = %v", err)
	}
}

func TestPlayerFailedTrackIsSkipped(t *testing.T) {
	h := newHarness(t, 1, time.Minute)
	h.src.fail["a"] = true
	h.p.Enqueue([]*Item{req("a", "ana"), req("b", "ana")}, "txt")
	eventually(t, "b tocando", func() bool { return nowID(h.p) == "b" })
	if !strings.Contains(strings.Join(h.n.publics, "\n"), TextFailed("A", "ana", "Sala 1")) {
		t.Fatalf("publics = %v", h.n.allPublics())
	}
}

func TestPlayerIdleTimeoutCloses(t *testing.T) {
	h := newHarness(t, 0.2, 50*time.Millisecond)
	h.p.Enqueue([]*Item{req("a", "ana")}, "txt")
	eventually(t, "a tocando", func() bool { return nowID(h.p) == "a" })
	eventually(t, "fechou por inatividade", func() bool {
		h.pull(5)
		h.n.mu.Lock()
		defer h.n.mu.Unlock()
		return h.n.closed == 1
	})
}

func TestPlayerOutputCrash(t *testing.T) {
	h := newHarness(t, 30, time.Minute)
	h.p.Enqueue([]*Item{req("a", "ana")}, "txt")
	eventually(t, "a tocando", func() bool { return nowID(h.p) == "a" })
	h.out.done <- errors.New("encoder caiu")
	eventually(t, "fechou", func() bool {
		h.n.mu.Lock()
		defer h.n.mu.Unlock()
		return h.n.closed == 1
	})
	if got := h.n.lastPublic(); got != TextCrashed("Sala 1") {
		t.Fatalf("public = %q", got)
	}
}

func TestPlayerVideoDownloadOnlyWhenWatched(t *testing.T) {
	h := newHarness(t, 30, time.Minute)
	it := req("a", "ana")
	it.Track.HasVideo = true
	h.p.Enqueue([]*Item{it}, "txt")
	eventually(t, "a tocando", func() bool { return nowID(h.p) == "a" })
	if _, ok := h.p.VideoPath("a"); ok {
		t.Fatal("sem ninguém assistindo não baixa vídeo")
	}
	h.p.SetWatching("ana", true)
	eventually(t, "vídeo pronto", func() bool { _, ok := h.p.VideoPath("a"); return ok })
}

// Started tardio de um item que a fila já tinha trocado de lugar: assume como atual.
func TestPlayerLateStartedAfterSwap(t *testing.T) {
	h := newHarness(t, 30, time.Minute)
	h.p.Enqueue([]*Item{req("a", "ana")}, "txt")
	eventually(t, "a tocando", func() bool { return nowID(h.p) == "a" })
	h.p.Enqueue([]*Item{req("b", "ana"), req("c", "ana")}, "txt")
	if err := h.p.Swap("b", "c", "ana"); err != nil {
		t.Fatal(err)
	}
	h.p.handleEvent(MixEvent{Kind: EventStarted, Tag: "b"})
	if nowID(h.p) != "b" {
		t.Fatalf("now = %q", nowID(h.p))
	}
	if q := h.p.Snapshot().Queue; len(q) != 1 || q[0].ID != "c" {
		t.Fatalf("fila = %+v", q)
	}
}

// Started tardio de um item removido: o mixer corta a faixa, now não muda.
func TestPlayerLateStartedAfterRemove(t *testing.T) {
	h := newHarness(t, 30, time.Minute)
	h.p.Enqueue([]*Item{req("a", "ana")}, "txt")
	eventually(t, "a tocando", func() bool { return nowID(h.p) == "a" })
	h.p.Enqueue([]*Item{req("b", "ana")}, "txt")
	if err := h.p.Remove("b", "ana"); err != nil {
		t.Fatal(err)
	}
	h.p.handleEvent(MixEvent{Kind: EventStarted, Tag: "b"})
	if nowID(h.p) != "a" {
		t.Fatalf("now = %q", nowID(h.p))
	}
	// O Skip do mixer faz a atual sumir: só termina se o handler o chamou.
	pulled := 0
	eventually(t, "a cortada", func() bool {
		if pulled < 100 { // 2 s de áudio: bem menos que os 30 s da faixa
			h.pull(5)
			pulled += 5
		}
		return nowID(h.p) == ""
	})
	if pulled >= 100 {
		t.Fatal("a não foi cortada")
	}
}

func TestPlayerIdleAfterRemovingPreparingItem(t *testing.T) {
	h := newHarness(t, 1, 50*time.Millisecond)
	release := make(chan struct{})
	h.p.deps.Prepare = func(context.Context, string) (io.ReadCloser, error) {
		<-release
		return src(1, 0.3), nil
	}
	h.p.Enqueue([]*Item{req("a", "ana")}, "txt")
	if err := h.p.Remove("a", "ana"); err != nil {
		t.Fatal(err)
	}
	close(release)
	eventually(t, "fechou por inatividade", func() bool {
		h.n.mu.Lock()
		defer h.n.mu.Unlock()
		return h.n.closed == 1
	})
}

func TestPlayerDoubleSkipIsIgnored(t *testing.T) {
	h := newHarness(t, 30, time.Minute)
	h.p.Enqueue([]*Item{req("a", "ana")}, "txt")
	eventually(t, "a tocando", func() bool { return nowID(h.p) == "a" })
	h.p.Skip("ana")
	if r := h.p.Skip("ana"); r.Kind != SkipDone {
		t.Fatalf("r = %+v", r)
	}
	n := 0
	for _, s := range h.n.allPublics() {
		if s == TextSkippedBy("A", "ana", "Sala 1") {
			n++
		}
	}
	if n != 1 {
		t.Fatalf("avisos de skip = %d", n)
	}
}
