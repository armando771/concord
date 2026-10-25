package lifecycle

import (
	"context"
	"net"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

// Um download longo para um cliente que não lê (ou lê devagar) não pode segurar
// o desligamento: Interrupt corta na hora (o app retoma com Range).
func TestInterruptCutsStreamingDownload(t *testing.T) {
	streams := NewStreams()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	writeErr := make(chan error, 1)
	started := make(chan struct{})
	router.GET("/updates/*file", streams.Gin(), func(c *gin.Context) {
		chunk := []byte(strings.Repeat("x", 64<<10))
		close(started)
		for {
			if _, err := c.Writer.Write(chunk); err != nil {
				writeErr <- err
				return
			}
		}
	})
	ln := listen(t)
	srv := &http.Server{Handler: router}
	go func() { _ = srv.Serve(ln) }()
	t.Cleanup(func() { srv.Close() })

	// Cliente que pede e nunca lê o corpo.
	conn, err := net.Dial("tcp", ln.Addr().String())
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()
	_, _ = conn.Write([]byte("GET /updates/Salinha-setup.exe HTTP/1.1\r\nHost: x\r\n\r\n"))
	<-started
	time.Sleep(100 * time.Millisecond) // buffers enchem, a escrita trava

	begin := time.Now()
	streams.Interrupt()
	select {
	case <-writeErr:
		if waited := time.Since(begin); waited > 500*time.Millisecond {
			t.Fatalf("download cortado só após %v", waited)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Interrupt não destravou o download")
	}
}

func TestStreamStartedAfterInterruptIsCutToo(t *testing.T) {
	streams := NewStreams()
	streams.Interrupt()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	writeErr := make(chan error, 1)
	router.GET("/media/:id", streams.Gin(), func(c *gin.Context) {
		chunk := []byte(strings.Repeat("x", 64<<10))
		for i := 0; i < 1000; i++ {
			if _, err := c.Writer.Write(chunk); err != nil {
				writeErr <- err
				return
			}
		}
		writeErr <- nil
	})
	ln := listen(t)
	srv := &http.Server{Handler: router}
	go func() { _ = srv.Serve(ln) }()
	t.Cleanup(func() { srv.Close() })

	conn, err := net.Dial("tcp", ln.Addr().String())
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()
	_, _ = conn.Write([]byte("GET /media/1 HTTP/1.1\r\nHost: x\r\n\r\n"))

	select {
	case err := <-writeErr:
		if err == nil {
			t.Fatal("stream novo depois do Interrupt foi até o fim")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("stream novo depois do Interrupt ficou travado")
	}
}

// Passado o prazo, o que sobrou é fechado à força: o processo sai e o novo sobe.
func TestShutdownForceClosesAfterTimeout(t *testing.T) {
	ln := listen(t)
	addr := ln.Addr().String()
	canceled := make(chan struct{})
	started := make(chan struct{})
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(started)
		<-r.Context().Done()
		close(canceled)
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
	stop()
	<-result

	select {
	case <-canceled:
	case <-time.After(time.Second):
		t.Fatal("a requisição presa continuou depois do prazo")
	}
}
