// Package health responde o GET /healthz: 200 só quando o servidor está
// pronto para atender (banco respondendo e chamadas ativas recarregadas). O
// Caddy usa isso para segurar as requisições durante um deploy, e o deploy
// para saber que o binário novo subiu.
package health

import (
	"context"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	stateStarting int32 = iota
	stateReady
	stateStopping
)

const pingTimeout = time.Second

type Readiness struct {
	state atomic.Int32
	ping  func(ctx context.Context) error
}

// New começa "subindo" (503) até SetReady. ping confere o banco a cada
// consulta.
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

	ctx, cancel := context.WithTimeout(c.Request.Context(), pingTimeout)
	defer cancel()
	if err := r.ping(ctx); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "database unavailable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
