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
