package websocket

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

// recordingRouter guarda os eventos de chamada que o WebSocket repassou.
type recordingRouter struct {
	events chan routedEvent
}

type routedEvent struct {
	userID  string
	evType  string
	payload json.RawMessage
}

func (r *recordingRouter) HandleCallMessage(userID string, evType string, payload json.RawMessage) {
	r.events <- routedEvent{userID: userID, evType: evType, payload: payload}
}

func (r *recordingRouter) IsParticipant(string, string) bool { return true }

// connectWithRouter abre um WS de verdade cujo readPump repassa para router.
func connectWithRouter(t *testing.T, router CallRouter, userID string) *websocket.Conn {
	t.Helper()
	hub := NewHub()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := websocket.Accept(w, r, nil)
		if err != nil {
			return
		}
		client := &Client{
			hub:        hub,
			conn:       conn,
			userID:     userID,
			send:       make(chan []byte, 32),
			rooms:      make(map[string]struct{}),
			callRouter: router,
		}
		ctx, cancel := context.WithCancel(r.Context())
		defer cancel()
		client.cancel = cancel
		hub.Register(client)
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
	return conn
}

// Eventos de chamada que o app manda pelo WS chegam ao serviço de chamadas
// com o usuário da conexão (não o do payload).
func TestCallEventReachesCallService(t *testing.T) {
	router := &recordingRouter{events: make(chan routedEvent, 4)}
	conn := connectWithRouter(t, router, "ana")

	msg := `{"type":"call:voice","payload":{"call_id":"call-1","muted":true}}`
	if err := conn.Write(context.Background(), websocket.MessageText, []byte(msg)); err != nil {
		t.Fatalf("write: %v", err)
	}

	select {
	case ev := <-router.events:
		if ev.userID != "ana" || ev.evType != "call:voice" {
			t.Fatalf("repassado = %s/%s, want ana/call:voice", ev.userID, ev.evType)
		}
		var p struct {
			CallID string `json:"call_id"`
			Muted  bool   `json:"muted"`
		}
		if err := json.Unmarshal(ev.payload, &p); err != nil || p.CallID != "call-1" || !p.Muted {
			t.Fatalf("payload = %s (%v)", ev.payload, err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("call:voice não chegou ao serviço de chamadas")
	}
}
