package websocket

import (
	"strings"
	"testing"

	"gin-quickstart/backend/internal/user"
)

func TestFriendEventsHideEmail(t *testing.T) {
	h := NewHub()
	recipient := newTestClient(h, "a")
	h.Register(recipient)
	h.Subscribe(recipient, "user:a")
	for len(recipient.send) > 0 {
		<-recipient.send
	}

	other := &user.User{ID: "b", Username: "baal", DisplayName: "Baal", Email: "b@x.com"}
	h.PublishFriendRequest("a", other)
	h.PublishFriendAccepted("a", other)
	h.PublishFriendDeclined("a", other)
	h.PublishFriendCancelled("a", other)
	h.PublishFriendRemoved("a", other)
	h.PublishUserBlocked("a", other)
	h.PublishUserUnblocked("a", other)

	got := 0
	for len(recipient.send) > 0 {
		raw := string(<-recipient.send)
		if !strings.Contains(raw, `"type":"friend:`) && !strings.Contains(raw, `"type":"relationship:`) {
			continue
		}
		got++
		if strings.Contains(raw, "b@x.com") || strings.Contains(raw, `"email"`) {
			t.Errorf("evento de amizade com e-mail: %s", raw)
		}
		if !strings.Contains(raw, `"username":"baal"`) {
			t.Errorf("evento perdeu o username: %s", raw)
		}
	}
	if got != 7 {
		t.Fatalf("recebeu %d eventos de amizade, want 7", got)
	}
}

func TestConversationEventGoesToEachMember(t *testing.T) {
	h := NewHub()
	clients := map[string]*Client{}
	for _, id := range []string{"a", "b", "c"} {
		cl := newTestClient(h, id)
		h.Register(cl)
		h.Subscribe(cl, "user:"+id)
		for len(cl.send) > 0 {
			<-cl.send
		}
		clients[id] = cl
	}

	h.PublishConversationEvent("conversation:create", "conv1", []string{"a", "b"})

	for id, want := range map[string]bool{"a": true, "b": true, "c": false} {
		got := false
		for len(clients[id].send) > 0 {
			if strings.Contains(string(<-clients[id].send), `"conversation_id":"conv1"`) {
				got = true
			}
		}
		if got != want {
			t.Errorf("%s recebeu = %v, want %v", id, got, want)
		}
	}
}
