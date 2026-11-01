package websocket

import (
	"context"
	"encoding/json"
	"testing"

	"gin-quickstart/backend/internal/user"
)

func newTestClient(h *Hub, userID string) *Client {
	return &Client{hub: h, userID: userID, send: make(chan []byte, 32), rooms: map[string]struct{}{}}
}

type presenceEvent struct {
	Type    string `json:"type"`
	Payload struct {
		UserID string `json:"user_id"`
		Online bool   `json:"online"`
		Status string `json:"status"`
	} `json:"payload"`
}

// drain devolve os eventos de presença que chegaram para c.
func drain(t *testing.T, c *Client) []presenceEvent {
	t.Helper()
	var events []presenceEvent
	for {
		select {
		case raw := <-c.send:
			var ev presenceEvent
			if err := json.Unmarshal(raw, &ev); err != nil {
				t.Fatal(err)
			}
			if ev.Type == "presence:update" {
				events = append(events, ev)
			}
		default:
			return events
		}
	}
}

func hubWithStatuses(statuses map[string]string) *Hub {
	h := NewHub()
	h.SetStatusLookup(func(_ context.Context, id string) (string, error) {
		if s, ok := statuses[id]; ok {
			return s, nil
		}
		return user.StatusOnline, nil
	})
	return h
}

func TestInvisibleConnectsSilently(t *testing.T) {
	h := hubWithStatuses(map[string]string{"b": user.StatusInvisible})
	watcher := newTestClient(h, "a")
	h.Register(watcher)
	drain(t, watcher)

	h.Register(newTestClient(h, "b"))
	if events := drain(t, watcher); len(events) != 0 {
		t.Fatalf("invisível não pode anunciar que conectou: %+v", events)
	}
	if got := h.PresenceMap([]string{"b"})["b"]; got != user.StatusOffline {
		t.Fatalf("invisível aparece como %q", got)
	}
	if !h.IsOnline("b") {
		t.Fatal("IsOnline continua dizendo se há conexão (chamadas tocam para o invisível)")
	}
}

func TestInvisibleDisconnectsSilently(t *testing.T) {
	h := hubWithStatuses(map[string]string{"b": user.StatusInvisible})
	watcher := newTestClient(h, "a")
	h.Register(watcher)
	drain(t, watcher)

	b := newTestClient(h, "b")
	h.Register(b)
	if events := drain(t, watcher); len(events) != 0 {
		t.Fatalf("invisível não pode anunciar que conectou: %+v", events)
	}

	h.Unregister(b)
	if events := drain(t, watcher); len(events) != 0 {
		t.Fatalf("invisível não pode anunciar que desconectou: %+v", events)
	}
}

func TestInternalPresenceDifferentiation(t *testing.T) {
	h := hubWithStatuses(map[string]string{"b": user.StatusInvisible})

	// Desconectado
	if h.IsConnected("b") {
		t.Fatal("desconectado não deve estar conectado")
	}
	if h.IsInvisible("b") {
		t.Fatal("desconectado não deve ser invisível")
	}
	if got := h.ChosenStatus("b"); got != user.StatusOffline {
		t.Fatalf("desconectado: status = %q, want %q", got, user.StatusOffline)
	}

	// Conectado como invisível
	b := newTestClient(h, "b")
	h.Register(b)
	if !h.IsConnected("b") {
		t.Fatal("deve diferenciar que está conectado")
	}
	if !h.IsInvisible("b") {
		t.Fatal("deve diferenciar que está invisível")
	}
	if got := h.ChosenStatus("b"); got != user.StatusInvisible {
		t.Fatalf("status escolhido = %q, want %q", got, user.StatusInvisible)
	}
	if got := h.EffectiveStatus("b"); got != user.StatusOffline {
		t.Fatalf("status efetivo = %q, want %q", got, user.StatusOffline)
	}

	// Transição para online
	h.SetUserStatus("b", user.StatusOnline)
	if !h.IsConnected("b") {
		t.Fatal("continua conectado")
	}
	if h.IsInvisible("b") {
		t.Fatal("não é mais invisível")
	}
	if got := h.ChosenStatus("b"); got != user.StatusOnline {
		t.Fatalf("status escolhido = %q, want %q", got, user.StatusOnline)
	}
	if got := h.EffectiveStatus("b"); got != user.StatusOnline {
		t.Fatalf("status efetivo = %q, want %q", got, user.StatusOnline)
	}
}

func TestConnectAnnouncesChosenStatus(t *testing.T) {
	h := hubWithStatuses(map[string]string{"b": user.StatusDND})
	watcher := newTestClient(h, "a")
	h.Register(watcher)
	drain(t, watcher)

	h.Register(newTestClient(h, "b"))
	events := drain(t, watcher)
	if len(events) != 1 || events[0].Payload.Status != user.StatusDND || !events[0].Payload.Online {
		t.Fatalf("eventos = %+v", events)
	}
}

func TestSetUserStatusBroadcastsOnlyChanges(t *testing.T) {
	h := hubWithStatuses(nil)
	watcher := newTestClient(h, "a")
	b := newTestClient(h, "b")
	h.Register(watcher)
	h.Register(b)
	drain(t, watcher)

	h.SetUserStatus("b", user.StatusIdle)
	events := drain(t, watcher)
	if len(events) != 1 || events[0].Payload.Status != user.StatusIdle {
		t.Fatalf("ausente: %+v", events)
	}

	h.SetUserStatus("b", user.StatusInvisible)
	events = drain(t, watcher)
	if len(events) != 1 || events[0].Payload.Status != user.StatusOffline || events[0].Payload.Online {
		t.Fatalf("invisível deveria aparecer offline: %+v", events)
	}

	h.SetUserStatus("b", user.StatusInvisible)
	if events := drain(t, watcher); len(events) != 0 {
		t.Fatalf("sem mudança, sem evento: %+v", events)
	}

	h.Unregister(b)
	drain(t, watcher)
	if got := h.EffectiveStatus("b"); got != user.StatusOffline {
		t.Fatalf("desconectado = %q", got)
	}
}

func TestPresenceMapReportsEffectiveStatus(t *testing.T) {
	h := hubWithStatuses(map[string]string{"b": user.StatusIdle})
	h.Register(newTestClient(h, "a"))
	h.Register(newTestClient(h, "b"))

	got := h.PresenceMap([]string{"a", "b", "c", ""})
	want := map[string]string{"a": user.StatusOnline, "b": user.StatusIdle, "c": user.StatusOffline}
	if len(got) != len(want) {
		t.Fatalf("PresenceMap = %v", got)
	}
	for id, status := range want {
		if got[id] != status {
			t.Errorf("%s = %q, want %q", id, got[id], status)
		}
	}
}

func TestPublishAppUpdateReachesEveryClient(t *testing.T) {
	h := hubWithStatuses(nil)
	a := newTestClient(h, "a")
	b := newTestClient(h, "b")
	h.Register(a)
	h.Register(b)
	drain(t, a)
	drain(t, b)

	h.PublishAppUpdate("latest.yml", "0.7.0")

	for _, c := range []*Client{a, b} {
		select {
		case raw := <-c.send:
			var ev struct {
				Type    string `json:"type"`
				Payload struct {
					File    string `json:"file"`
					Version string `json:"version"`
				} `json:"payload"`
			}
			if err := json.Unmarshal(raw, &ev); err != nil {
				t.Fatal(err)
			}
			if ev.Type != "app:update" || ev.Payload.Version != "0.7.0" || ev.Payload.File != "latest.yml" {
				t.Fatalf("evento %s", raw)
			}
		default:
			t.Fatalf("%s não recebeu app:update", c.userID)
		}
	}
}
