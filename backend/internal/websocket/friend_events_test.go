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

	got := 0
	for len(recipient.send) > 0 {
		raw := string(<-recipient.send)
		if !strings.Contains(raw, `"type":"friend:`) {
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
	if got != 5 {
		t.Fatalf("recebeu %d eventos de amizade, want 5", got)
	}
}
