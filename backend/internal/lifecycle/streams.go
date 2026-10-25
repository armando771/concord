package lifecycle

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Streams acompanha as respostas longas (download de atualização, vídeo/áudio
// do chat) para o desligamento cortá-las na hora em vez de esperar: um cliente
// lento ou parado seguraria o reinício inteiro, e quem baixa retoma com Range.
type Streams struct {
	mu          sync.Mutex
	active      map[*http.ResponseController]struct{}
	interrupted bool
}

func NewStreams() *Streams {
	return &Streams{active: make(map[*http.ResponseController]struct{})}
}

// Gin marca as rotas que podem ser cortadas no desligamento.
func (s *Streams) Gin() gin.HandlerFunc {
	return func(c *gin.Context) {
		rc := http.NewResponseController(c.Writer)
		s.mu.Lock()
		if s.interrupted {
			s.mu.Unlock()
			cut(rc)
		} else {
			s.active[rc] = struct{}{}
			s.mu.Unlock()
		}
		defer func() {
			s.mu.Lock()
			delete(s.active, rc)
			s.mu.Unlock()
		}()
		c.Next()
	}
}

// Interrupt corta as respostas em andamento e as que começarem depois.
func (s *Streams) Interrupt() {
	s.mu.Lock()
	s.interrupted = true
	list := make([]*http.ResponseController, 0, len(s.active))
	for rc := range s.active {
		list = append(list, rc)
	}
	s.mu.Unlock()
	for _, rc := range list {
		cut(rc)
	}
}

// cut faz a escrita (e a leitura) travada falhar agora.
func cut(rc *http.ResponseController) {
	now := time.Now()
	_ = rc.SetWriteDeadline(now)
	_ = rc.SetReadDeadline(now)
}
