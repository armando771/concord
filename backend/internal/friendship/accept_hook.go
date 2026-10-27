package friendship

import (
	"context"
	"sync"

	"gin-quickstart/backend/internal/user"
)

// AcceptHook repassa os eventos ao publisher e, quando uma amizade é
// aceita, avisa quem se inscreveu com as duas pessoas (o badge Amigos
// reavalia na hora). A inscrição vem depois do wiring da amizade, porque os
// badges são montados mais tarde.
type AcceptHook struct {
	EventPublisher
	mu        sync.RWMutex
	listeners []func(ctx context.Context, userID string)
}

func WithAcceptHook(publisher EventPublisher) *AcceptHook {
	return &AcceptHook{EventPublisher: publisher}
}

// OnAccepted inscreve fn para cada pessoa de uma amizade nova.
func (h *AcceptHook) OnAccepted(fn func(ctx context.Context, userID string)) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.listeners = append(h.listeners, fn)
}

func (h *AcceptHook) PublishFriendAccepted(requesterID string, friend *user.User) {
	h.EventPublisher.PublishFriendAccepted(requesterID, friend)
	h.mu.RLock()
	listeners := h.listeners
	h.mu.RUnlock()
	for _, fn := range listeners {
		fn(context.Background(), requesterID)
		fn(context.Background(), friend.ID)
	}
}
