package music

// Grava as sessões fora do lock do player: o PublishState chama com p.mu
// preso, então a escrita no banco vai para uma goroutine. Por canal só vale a
// última (várias mudanças seguidas viram uma escrita) e a ordem se mantém:
// um apagar nunca é atropelado por uma gravação mais velha.

import (
	"context"
	"log"
	"sync"
	"time"
)

const sessionWriteTimeout = 5 * time.Second

type sessionWriter struct {
	store SessionStore

	mu      sync.Mutex
	pending map[string]*Session // canal → última sessão; nil = apagar
	running bool
	idle    *sync.Cond // avisa quando a goroutine termina
	// frozen: desligando. Só a gravação final (flush) entra.
	frozen bool
}

func newSessionWriter(store SessionStore) *sessionWriter {
	w := &sessionWriter{store: store, pending: map[string]*Session{}}
	w.idle = sync.NewCond(&w.mu)
	return w
}

// put agenda a gravação (s != nil) ou o apagar (s == nil) da sessão do canal.
func (w *sessionWriter) put(channelID string, s *Session) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if !w.frozen {
		w.scheduleLocked(channelID, s)
	}
}

func (w *sessionWriter) scheduleLocked(channelID string, s *Session) {
	w.pending[channelID] = s
	if !w.running {
		w.running = true
		go w.drain()
	}
}

func (w *sessionWriter) drain() {
	for {
		w.mu.Lock()
		channelID, s, ok := w.nextLocked()
		if !ok {
			w.running = false
			w.idle.Broadcast()
			w.mu.Unlock()
			return
		}
		w.mu.Unlock()
		w.write(channelID, s)
	}
}

func (w *sessionWriter) nextLocked() (string, *Session, bool) {
	for channelID, s := range w.pending {
		delete(w.pending, channelID)
		return channelID, s, true
	}
	return "", nil, false
}

func (w *sessionWriter) write(channelID string, s *Session) {
	ctx, cancel := context.WithTimeout(context.Background(), sessionWriteTimeout)
	defer cancel()
	var err error
	if s == nil {
		err = w.store.Delete(ctx, channelID)
	} else {
		err = w.store.Save(ctx, *s)
	}
	if err != nil {
		log.Printf("[music] gravar sessão do canal %s: %v", channelID, err)
	}
}

// freeze: dali em diante put não faz nada (desligamento).
func (w *sessionWriter) freeze() {
	w.mu.Lock()
	w.frozen = true
	w.mu.Unlock()
}

// flush grava as sessões finais e espera tudo o que estava na fila terminar.
func (w *sessionWriter) flush(final []Session) {
	w.mu.Lock()
	defer w.mu.Unlock()
	for i := range final {
		w.scheduleLocked(final[i].ChannelID, &final[i])
	}
	for w.running {
		w.idle.Wait()
	}
}
