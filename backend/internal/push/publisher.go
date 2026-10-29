package push

import (
	"sync/atomic"

	"gin-quickstart/backend/internal/friendship"
	"gin-quickstart/backend/internal/message"
	"gin-quickstart/backend/internal/user"
)

// Sink recebe os eventos que interessam ao push.
type Sink interface {
	OnMessage(ev message.CreateEvent)
	OnFriendRequest(recipientID string, requester *user.User)
}

// Tap liga os publicadores ao Notifier depois que ele existe (o wiring cria os serviços antes).
// Sem Sink (push desligado ou ainda não ligado) os decoradores só repassam ao Hub.
type Tap struct{ sink atomic.Pointer[Sink] }

func NewTap() *Tap { return &Tap{} }

func (t *Tap) Set(s Sink) { t.sink.Store(&s) }

func (t *Tap) get() Sink {
	if p := t.sink.Load(); p != nil {
		return *p
	}
	return nil
}

type messagePublisher struct {
	message.EventPublisher
	tap *Tap
}

// WrapMessages entrega ao Hub primeiro e depois avisa o push.
func WrapMessages(inner message.EventPublisher, tap *Tap) message.EventPublisher {
	return messagePublisher{EventPublisher: inner, tap: tap}
}

func (p messagePublisher) PublishMessageCreate(ev message.CreateEvent) {
	p.EventPublisher.PublishMessageCreate(ev)
	if s := p.tap.get(); s != nil {
		s.OnMessage(ev)
	}
}

type friendPublisher struct {
	friendship.EventPublisher
	tap *Tap
}

func WrapFriends(inner friendship.EventPublisher, tap *Tap) friendship.EventPublisher {
	return friendPublisher{EventPublisher: inner, tap: tap}
}

func (p friendPublisher) PublishFriendRequest(recipientID string, requester *user.User) {
	p.EventPublisher.PublishFriendRequest(recipientID, requester)
	if s := p.tap.get(); s != nil {
		s.OnFriendRequest(recipientID, requester)
	}
}
