package music

import (
	"context"
	"errors"
	"io"
	"sync"
	"testing"
	"time"
)

// Faixa retomada (ResumeAt): o ffmpeg começa da posição salva e o painel
// mostra a barra já andada, não do zero.
func TestPlayerResumeAtSeeksAndBackdatesStart(t *testing.T) {
	h := newHarness(t, 30, time.Minute)
	var mu sync.Mutex
	var seeks []time.Duration
	h.p.deps.Prepare = func(_ context.Context, _ string, at time.Duration) (io.ReadCloser, error) {
		mu.Lock()
		seeks = append(seeks, at)
		mu.Unlock()
		return src(30, 0.3), nil
	}
	a := req("a", "ana")
	a.ResumeAt = 90 * time.Second
	h.p.Enqueue([]*Item{a, req("b", "ana")}, "txt")
	eventually(t, "a tocando", func() bool { return nowID(h.p) == "a" })

	mu.Lock()
	got := append([]time.Duration(nil), seeks...)
	mu.Unlock()
	if len(got) == 0 || got[0] != 90*time.Second {
		t.Fatalf("seek da retomada = %v, want [90s ...]", got)
	}
	if ago := time.Since(h.p.Snapshot().StartedAt); ago < 90*time.Second || ago > 95*time.Second {
		t.Fatalf("começou há %v, want ~90s (a barra do painel já andada)", ago)
	}
}

// Desligamento do servidor: o player devolve onde estava e fica mudo. Os
// ffmpeg morrem junto com o SIGTERM: a queda da saída não vira aviso no chat
// nem apaga a sessão (o Manager não fica sabendo do fechamento).
func TestPlayerFreezeReturnsSessionAndGoesQuiet(t *testing.T) {
	h := newHarness(t, 30, time.Minute)
	h.p.Enqueue([]*Item{req("a", "ana"), req("b", "bia")}, "txt")
	eventually(t, "a tocando", func() bool { return nowID(h.p) == "a" })

	s := h.p.Freeze()
	if s == nil || s.Now == nil || s.Now.ID != "a" || len(s.Queue) != 1 || s.Queue[0].ID != "b" {
		t.Fatalf("sessão = %+v", s)
	}
	if s.ChannelID != "ch1" || s.CallID != "call1" || s.ServerID != "srv1" || s.TextChannelID != "txt" {
		t.Fatalf("local da sessão = %+v", s)
	}
	if s.Position < 0 || s.Position > 2*time.Second {
		t.Fatalf("posição = %v", s.Position)
	}
	if s.Queue[0].RequestedBy.ID != "bia" || s.Now.Track.Title != "A" {
		t.Fatalf("itens = %+v / %+v", s.Now, s.Queue[0])
	}

	h.p.shutdown(true) // a saída caiu porque o ffmpeg do encoder morreu
	h.p.Close()
	h.n.mu.Lock()
	defer h.n.mu.Unlock()
	if len(h.n.publics) != 0 || h.n.closed != 0 {
		t.Fatalf("depois de congelar: avisos=%v fechados=%d", h.n.publics, h.n.closed)
	}
	if h.p.Freeze() != nil {
		t.Fatal("congelar de novo não devolve outra sessão")
	}
}

// Nada tocando nem na fila: não há o que retomar.
func TestPlayerSessionEmptyWhenIdle(t *testing.T) {
	h := newHarness(t, 30, time.Minute)
	if s := h.p.Freeze(); s != nil {
		t.Fatalf("sessão de player ocioso = %+v", s)
	}
}

// Faixa retomada no meio não conta de novo no DJ se já tinha passado do tempo.
func TestPlayerResumePastPlayedDoesNotCreditAgain(t *testing.T) {
	h := newHarnessPlayed(t, 30, time.Minute, 20*time.Millisecond)
	a := req("a", "ana")
	a.ResumeAt = time.Minute
	h.p.Enqueue([]*Item{a}, "txt")
	eventually(t, "a tocando", func() bool { return nowID(h.p) == "a" })
	h.p.Enqueue([]*Item{req("b", "bia")}, "txt")
	h.p.Skip("ana")
	eventually(t, "b tocando", func() bool { h.pull(5); return nowID(h.p) == "b" })
	eventually(t, "b contou no DJ", func() bool { return len(h.n.allPlayed()) > 0 })
	if got := h.n.allPlayed(); len(got) != 1 || got[0] != "call1:bia" {
		t.Fatalf("DJ = %v, want só a b (a retomada já tinha contado)", got)
	}
}

type fakeSessions struct {
	mu      sync.Mutex
	saved   map[string]Session
	deleted []string
	list    []Session
	listErr error
	saves   int
	// gate segura cada gravação até alguém mandar um valor (nil = não segura).
	gate chan struct{}
}

func newFakeSessions(list ...Session) *fakeSessions {
	return &fakeSessions{saved: map[string]Session{}, list: list}
}

func (f *fakeSessions) Save(_ context.Context, s Session) error {
	if f.gate != nil {
		<-f.gate
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.saved[s.ChannelID] = s
	f.saves++
	return nil
}

func (f *fakeSessions) saveCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.saves
}

func (f *fakeSessions) Delete(_ context.Context, channelID string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.saved, channelID)
	f.deleted = append(f.deleted, channelID)
	return nil
}

func (f *fakeSessions) List(context.Context) ([]Session, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]Session(nil), f.list...), f.listErr
}

func (f *fakeSessions) get(channelID string) (Session, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	s, ok := f.saved[channelID]
	return s, ok
}

func (f *fakeSessions) wasDeleted(channelID string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, id := range f.deleted {
		if id == channelID {
			return true
		}
	}
	return false
}

func TestSessionWriterSavesDeletesAndCoalesces(t *testing.T) {
	store := newFakeSessions()
	store.gate = make(chan struct{})
	w := newSessionWriter(store)
	w.put("c1", &Session{ChannelID: "c1", Position: time.Second})
	// Enquanto a primeira grava, as seguintes do mesmo canal viram uma só.
	w.put("c1", &Session{ChannelID: "c1", Position: 2 * time.Second})
	w.put("c1", &Session{ChannelID: "c1", Position: 3 * time.Second})
	close(store.gate)
	eventually(t, "última posição gravada", func() bool {
		s, ok := store.get("c1")
		return ok && s.Position == 3*time.Second
	})
	if n := store.saveCount(); n > 2 {
		t.Fatalf("%d gravações para 3 mudanças seguidas", n)
	}
	w.put("c1", nil)
	eventually(t, "sessão apagada", func() bool { return store.wasDeleted("c1") })
}

// Congelado (desligando): o que os players fazem depois não muda o banco; só
// a gravação final (flush) entra, e o flush espera ela terminar.
func TestSessionWriterFreezeKeepsOnlyFinal(t *testing.T) {
	store := newFakeSessions()
	w := newSessionWriter(store)
	w.freeze()
	w.put("c1", nil)
	w.put("c2", &Session{ChannelID: "c2"})
	w.flush([]Session{{ChannelID: "c1", Position: 5 * time.Second}})
	if s, ok := store.get("c1"); !ok || s.Position != 5*time.Second {
		t.Fatalf("final = %+v %v", s, ok)
	}
	if store.wasDeleted("c1") {
		t.Fatal("apagou depois de congelar")
	}
	if _, ok := store.get("c2"); ok {
		t.Fatal("gravou depois de congelar")
	}
}

type failingSessions struct{ *fakeSessions }

func (f *failingSessions) Save(context.Context, Session) error { return errors.New("banco fora") }

// Banco fora: a gravação falha no log e o writer segue (não trava o player).
func TestSessionWriterSurvivesStoreErrors(t *testing.T) {
	store := &failingSessions{fakeSessions: newFakeSessions()}
	w := newSessionWriter(store)
	w.put("c1", &Session{ChannelID: "c1"})
	w.flush(nil)
	w.put("c1", nil)
	w.flush(nil)
	if !store.wasDeleted("c1") {
		t.Fatal("depois do erro o writer parou")
	}
}
