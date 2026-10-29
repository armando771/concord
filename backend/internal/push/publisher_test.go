package push

import (
	"testing"

	"gin-quickstart/backend/internal/friendship"
	"gin-quickstart/backend/internal/message"
	"gin-quickstart/backend/internal/user"
)

type order struct{ calls []string }

type innerMessages struct {
	message.EventPublisher
	o *order
}

func (i innerMessages) PublishMessageCreate(message.CreateEvent) {
	i.o.calls = append(i.o.calls, "hub")
}

type innerFriends struct {
	friendship.EventPublisher
	o *order
}

func (i innerFriends) PublishFriendRequest(string, *user.User) { i.o.calls = append(i.o.calls, "hub") }

type sink struct{ o *order }

func (s sink) OnMessage(message.CreateEvent)      { s.o.calls = append(s.o.calls, "push") }
func (s sink) OnFriendRequest(string, *user.User) { s.o.calls = append(s.o.calls, "push") }

func TestDecoradorDeMensagens(t *testing.T) {
	t.Run("entrega ao Hub primeiro e depois avisa o push", func(t *testing.T) {
		o := &order{}
		tap := NewTap()
		tap.Set(sink{o})
		WrapMessages(innerMessages{o: o}, tap).PublishMessageCreate(message.CreateEvent{})
		if len(o.calls) != 2 || o.calls[0] != "hub" || o.calls[1] != "push" {
			t.Fatalf("ordem = %v", o.calls)
		}
	})

	t.Run("push ainda não ligado: só o Hub, sem pânico", func(t *testing.T) {
		o := &order{}
		WrapMessages(innerMessages{o: o}, NewTap()).PublishMessageCreate(message.CreateEvent{})
		if len(o.calls) != 1 || o.calls[0] != "hub" {
			t.Fatalf("ordem = %v", o.calls)
		}
	})
}

func TestDecoradorDeAmizade(t *testing.T) {
	o := &order{}
	tap := NewTap()
	tap.Set(sink{o})
	WrapFriends(innerFriends{o: o}, tap).PublishFriendRequest("u1", &user.User{ID: "u2"})
	if len(o.calls) != 2 || o.calls[0] != "hub" || o.calls[1] != "push" {
		t.Fatalf("ordem = %v", o.calls)
	}

	// sem push ligado, só o Hub
	o2 := &order{}
	WrapFriends(innerFriends{o: o2}, NewTap()).PublishFriendRequest("u1", &user.User{ID: "u2"})
	if len(o2.calls) != 1 {
		t.Fatalf("sem push: %v", o2.calls)
	}
}
