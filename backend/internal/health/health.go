// Package health responde o GET /healthz: 200 só quando o servidor está
// pronto para atender (banco respondendo e chamadas ativas recarregadas). O
// deploy e o scripts/apply-caddyfile.sh usam isso para saber que o binário
// novo subiu.
//
// É público (o apply-caddyfile confere pelo endereço de fora) e inofensivo:
// não diz nada além de ok/starting/stopping/database unavailable, e o banco é
// consultado no máximo uma vez por pingEvery, por mais que batam nele.
package health

import (
	"context"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	stateStarting int32 = iota
	stateReady
	stateStopping
)

const (
	pingTimeout = time.Second
	pingEvery   = time.Second
)

type Readiness struct {
	state atomic.Int32
	ping  func(ctx context.Context) error

	// Último ping ao banco, reaproveitado por pingEvery (uma consulta por vez).
	mu        sync.Mutex
	checkedAt time.Time
	lastErr   error
}

// New começa "subindo" (503) até SetReady. ping confere o banco (no máximo
// uma vez por pingEvery).
func New(ping func(ctx context.Context) error) *Readiness {
	return &Readiness{ping: ping}
}

// SetReady marca o fim da subida (migrations e chamadas recarregadas).
func (r *Readiness) SetReady() { r.state.Store(stateReady) }

// SetStopping marca o início do desligamento: o servidor não aceita mais nada.
func (r *Readiness) SetStopping() { r.state.Store(stateStopping) }

func (r *Readiness) Handler(c *gin.Context) {
	switch r.state.Load() {
	case stateStarting:
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "starting"})
		return
	case stateStopping:
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "stopping"})
		return
	}

	if err := r.pingDatabase(c.Request.Context()); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "database unavailable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// pingDatabase consulta o banco ou devolve o resultado de menos de pingEvery
// atrás.
func (r *Readiness) pingDatabase(ctx context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.checkedAt.IsZero() && time.Since(r.checkedAt) < pingEvery {
		return r.lastErr
	}
	ctx, cancel := context.WithTimeout(ctx, pingTimeout)
	defer cancel()
	r.lastErr = r.ping(ctx)
	r.checkedAt = time.Now()
	return r.lastErr
}
