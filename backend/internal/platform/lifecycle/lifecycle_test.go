package lifecycle

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"testing"
	"time"
)

func listen(t *testing.T) net.Listener {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	return ln
}

func TestShutdownFinishesInFlightRequests(t *testing.T) {
	ln := listen(t)
	addr := ln.Addr().String()
	started := make(chan struct{})
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(started)
		time.Sleep(200 * time.Millisecond)
		_, _ = io.WriteString(w, "terminou")
	})}

	ctx, stop := context.WithCancel(context.Background())
	result := make(chan error, 1)
	go func() { result <- Run(ctx, srv, ln, 2*time.Second, nil) }()

	body := make(chan string, 1)
	go func() {
		resp, err := http.Get("http://" + addr + "/upload")
		if err != nil {
			body <- "erro: " + err.Error()
			return
		}
		defer resp.Body.Close()
		b, _ := io.ReadAll(resp.Body)
		body <- string(b)
	}()
	<-started
	stop() // SIGTERM no meio da requisição

	if got := <-body; got != "terminou" {
		t.Fatalf("requisição em andamento = %q, want terminou", got)
	}
	if err := <-result; err != nil {
		t.Fatalf("Run = %v, want nil", err)
	}
}

func TestStreamsCloseOnlyAfterListenerStopsAccepting(t *testing.T) {
	ln := listen(t)
	addr := ln.Addr().String()
	srv := &http.Server{Handler: http.NotFoundHandler()}

	dialErr := make(chan error, 1)
	closeStreams := func(context.Context) {
		// Quem reconectar agora tem que cair no processo novo, não neste.
		conn, err := net.DialTimeout("tcp", addr, 200*time.Millisecond)
		if err == nil {
			conn.Close()
		}
		dialErr <- err
	}

	ctx, stop := context.WithCancel(context.Background())
	result := make(chan error, 1)
	go func() { result <- Run(ctx, srv, ln, time.Second, closeStreams) }()
	time.Sleep(20 * time.Millisecond)
	stop()

	if err := <-dialErr; err == nil {
		t.Fatal("o servidor ainda aceitava conexões quando os WebSockets foram fechados")
	}
	if err := <-result; err != nil {
		t.Fatalf("Run = %v", err)
	}
}

func TestShutdownGivesUpAfterTimeout(t *testing.T) {
	ln := listen(t)
	addr := ln.Addr().String()
	started := make(chan struct{})
	release := make(chan struct{})
	defer close(release)
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(started)
		<-release
	})}

	ctx, stop := context.WithCancel(context.Background())
	result := make(chan error, 1)
	go func() { result <- Run(ctx, srv, ln, 100*time.Millisecond, nil) }()
	go func() {
		if resp, err := http.Get("http://" + addr + "/preso"); err == nil {
			resp.Body.Close()
		}
	}()
	<-started
	begin := time.Now()
	stop()

	select {
	case err := <-result:
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("Run = %v, want DeadlineExceeded", err)
		}
		if waited := time.Since(begin); waited > time.Second {
			t.Fatalf("esperou %v, want ~100ms", waited)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Run não desistiu da requisição presa")
	}
}

func TestServeErrorIsReturned(t *testing.T) {
	ln := listen(t)
	ln.Close() // porta já fechada: Serve falha na hora
	srv := &http.Server{Handler: http.NotFoundHandler()}
	if err := Run(context.Background(), srv, ln, time.Second, nil); err == nil {
		t.Fatal("Run = nil, want erro do Serve")
	}
}
