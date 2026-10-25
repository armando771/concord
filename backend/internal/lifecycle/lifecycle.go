// Package lifecycle serve HTTP até o sinal de desligar e então desliga sem
// cortar ninguém no meio: para de aceitar conexões, fecha os WebSockets (que
// o http.Server não acompanha) e espera as requisições em andamento.
package lifecycle

import (
	"context"
	"errors"
	"net"
	"net/http"
	"time"
)

// Run serve srv em ln até ctx acabar (SIGTERM). Depois, na ordem:
//  1. o listener fecha: conexões novas esperam no Caddy pelo processo novo;
//  2. closeStreams fecha as conexões sequestradas (WebSockets do chat);
//  3. espera as requisições em andamento (uploads inclusive) até timeout.
//
// Devolve o erro do Serve (ex.: porta ocupada) ou o do desligamento
// (context.DeadlineExceeded se algo não terminou a tempo).
func Run(ctx context.Context, srv *http.Server, ln net.Listener, timeout time.Duration, closeStreams func(context.Context)) error {
	served := make(chan error, 1)
	go func() { served <- srv.Serve(ln) }()

	select {
	case err := <-served:
		return err
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	// O http.Server chama isto logo depois de fechar os listeners.
	listenerClosed := make(chan struct{})
	srv.RegisterOnShutdown(func() { close(listenerClosed) })
	shutdown := make(chan error, 1)
	go func() { shutdown <- srv.Shutdown(shutdownCtx) }()

	select {
	case <-listenerClosed:
		if closeStreams != nil {
			closeStreams(shutdownCtx)
		}
	case <-shutdownCtx.Done():
	}

	err := <-shutdown
	if serveErr := <-served; serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) && err == nil {
		err = serveErr
	}
	return err
}
