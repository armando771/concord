package friendship

import "gin-quickstart/backend/internal/user"

type EventPublisher interface {
	PublishFriendRequest(recipientID string, requester *user.User)
	PublishFriendAccepted(requesterID string, friend *user.User)
	PublishFriendDeclined(requesterID string, declined *user.User)
	PublishFriendCancelled(recipientID string, requester *user.User)
	PublishFriendRemoved(recipientID string, removed *user.User)
	// Vão só para quem bloqueou (sincroniza os outros dispositivos dele).
	PublishUserBlocked(blockerID string, blocked *user.User)
	PublishUserUnblocked(blockerID string, unblocked *user.User)
}

type FriendRequestEvent struct {
	UserID string     `json:"user_id,omitempty"`
	User   *user.User `json:"user,omitempty"`
}
