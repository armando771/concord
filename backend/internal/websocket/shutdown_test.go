package websocket

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/coder/websocket"
)

// connectClient abre um WS de verdade contra um servidor de teste que
// registra a conexão no hub, como o ServeWS.
func connectClient(t *testing.T, hub *Hub, userID string) *websocket.Conn {
	t.Helper()
	registered := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := websocket.Accept(w, r, nil)
		if err != nil {
			return
		}
		client := &Client{
			hub:    hub,
			conn:   conn,
			userID: userID,
			send:   make(chan []byte, 32),
			rooms:  make(map[string]struct{}),
		}
		ctx, cancel := context.WithCancel(r.Context())
		defer cancel()
		client.cancel = cancel
		hub.Register(client)
		close(registered)
		go client.writePump(ctx)
		client.readPump(ctx)
	}))
	t.Cleanup(srv.Close)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	conn, _, err := websocket.Dial(ctx, "ws"+strings.TrimPrefix(srv.URL, "http"), nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { conn.CloseNow() })
	<-registered
	return conn
}

// readUntilClose lê em segundo plano (como o app, que responde ao
// fechamento) e entrega o erro de fechamento.
func readUntilClose(conn *websocket.Conn) <-chan error {
	out := make(chan error, 1)
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		for {
			if _, _, err := conn.Read(ctx); err != nil {
				out <- err
				return
			}
		}
	}()
	return out
}

func TestShutdownClosesClientsWithServiceRestart(t *testing.T) {
	hub := NewHub()
	conn := connectClient(t, hub, "ana")
	closed := readUntilClose(conn)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	hub.Shutdown(ctx)

	err := <-closed
	var closeErr websocket.CloseError
	if !errors.As(err, &closeErr) {
		t.Fatalf("err = %v, want CloseError", err)
	}
	if closeErr.Code != CloseServiceRestart || closeErr.Reason != closeRestartReason {
		t.Fatalf("close = %d %q, want %d %q", closeErr.Code, closeErr.Reason, CloseServiceRestart, closeRestartReason)
	}
}

func TestShutdownDoesNotTreatUsersAsGone(t *testing.T) {
	hub := NewHub()
	var disconnects atomic.Int32
	hub.SetDisconnectHandler(func(string) { disconnects.Add(1) })
	conn := connectClient(t, hub, "ana")
	closed := readUntilClose(conn)
	other := connectClient(t, hub, "bia")
	offline := make(chan string, 4)
	otherClosed := make(chan struct{})
	go func() {
		defer close(otherClosed)
		for {
			_, data, err := other.Read(context.Background())
			if err != nil {
				return
			}
			if strings.Contains(string(data), `"online":false`) {
				offline <- string(data)
			}
		}
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	hub.Shutdown(ctx)
	<-closed
	<-otherClosed

	// Ninguém sai da chamada nem fica offline para os outros: o processo novo
	// recarrega as chamadas e os clientes voltam em instantes.
	time.Sleep(50 * time.Millisecond)
	if n := disconnects.Load(); n != 0 {
		t.Fatalf("disconnect handler chamado %d vez(es) no desligamento", n)
	}
	select {
	case data := <-offline:
		t.Fatalf("presença offline publicada no desligamento: %s", data)
	default:
	}
}

// Um cliente que não responde ao fechamento (notebook que dormiu) não pode
// segurar o reinício: o prazo do ctx manda.
func TestShutdownDoesNotWaitForDeadClient(t *testing.T) {
	hub := NewHub()
	_ = connectClient(t, hub, "ana") // nunca lê: não confirma o fechamento

	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancel()
	begin := time.Now()
	hub.Shutdown(ctx)
	if waited := time.Since(begin); waited > 600*time.Millisecond {
		t.Fatalf("Shutdown esperou %v pelo cliente morto", waited)
	}
}

// Conexão que chega depois do Shutdown não entra no hub (ficaria sem o 1012).
func TestRegisterRefusedWhileShuttingDown(t *testing.T) {
	hub := NewHub()
	hub.Shutdown(context.Background())
	if hub.Register(&Client{hub: hub, userID: "ana", rooms: map[string]struct{}{}}) {
		t.Fatal("Register aceitou cliente durante o desligamento")
	}
	if hub.IsOnline("ana") {
		t.Fatal("cliente recusado ficou online")
	}
}
