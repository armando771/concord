package friendship

import (
	"context"
	"reflect"
	"testing"

	"gin-quickstart/backend/internal/user"
)

type acceptedRecorder struct {
	EventPublisher
	accepted []string
}

func (r *acceptedRecorder) PublishFriendAccepted(requesterID string, friend *user.User) {
	r.accepted = append(r.accepted, requesterID+">"+friend.ID)
}

func TestAcceptHookForwardsAndWarnsBothFriends(t *testing.T) {
	inner := &acceptedRecorder{}
	hook := WithAcceptHook(inner)
	// Sem ninguém inscrito, só repassa.
	hook.PublishFriendAccepted("ana", &user.User{ID: "bia"})

	var got []string
	hook.OnAccepted(func(_ context.Context, userID string) { got = append(got, userID) })
	hook.PublishFriendAccepted("caio", &user.User{ID: "duda"})

	if !reflect.DeepEqual(inner.accepted, []string{"ana>bia", "caio>duda"}) {
		t.Fatalf("publisher recebeu %v", inner.accepted)
	}
	if !reflect.DeepEqual(got, []string{"caio", "duda"}) {
		t.Fatalf("inscrito recebeu %v, want as duas pessoas", got)
	}
}
