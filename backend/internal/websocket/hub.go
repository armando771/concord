package websocket

import (
	"sync"

	"gin-quickstart/backend/internal/channel"
	"gin-quickstart/backend/internal/message"
	"gin-quickstart/backend/internal/server"
	"gin-quickstart/backend/internal/user"
)

type Hub struct {
	mu           sync.RWMutex
	clients      map[*Client]struct{}
	rooms        map[string]map[*Client]struct{}
	presence     map[string]int
	onDisconnect func(userID string)
}

func NewHub() *Hub {
	return &Hub{
		clients:  make(map[*Client]struct{}),
		rooms:    make(map[string]map[*Client]struct{}),
		presence: make(map[string]int),
	}
}

// SetDisconnectHandler registers a callback invoked when the last WS
// connection of a user closes (user fully offline).
func (h *Hub) SetDisconnectHandler(fn func(userID string)) {
	h.mu.Lock()
	h.onDisconnect = fn
	h.mu.Unlock()
}

func (h *Hub) Register(client *Client) {
	h.mu.Lock()
	h.clients[client] = struct{}{}
	h.presence[client.userID]++
	wasOffline := h.presence[client.userID] == 1
	h.mu.Unlock()

	if wasOffline {
		h.BroadcastAll(writeEvent("presence:update", map[string]interface{}{
			"user_id": client.userID,
			"online":  true,
		}))
	}
}

func (h *Hub) Unregister(client *Client) {
	h.mu.Lock()
	delete(h.clients, client)
	for room := range client.rooms {
		h.removeFromRoomLocked(client, room)
	}
	client.rooms = map[string]struct{}{}

	wasOnline := false
	h.presence[client.userID]--
	if h.presence[client.userID] <= 0 {
		delete(h.presence, client.userID)
		wasOnline = true
	}
	h.mu.Unlock()

	if wasOnline && h.onDisconnect != nil {
		h.onDisconnect(client.userID)
	}

	if wasOnline {
		h.BroadcastAll(writeEvent("presence:update", map[string]interface{}{
			"user_id": client.userID,
			"online":  false,
		}))
	}
}

func (h *Hub) Subscribe(client *Client, room string) {
	h.mu.Lock()
	if h.rooms[room] == nil {
		h.rooms[room] = make(map[*Client]struct{})
	}
	h.rooms[room][client] = struct{}{}
	client.rooms[room] = struct{}{}
	h.mu.Unlock()
}

func (h *Hub) Unsubscribe(client *Client, room string) {
	h.mu.Lock()
	h.removeFromRoomLocked(client, room)
	h.mu.Unlock()
}

func (h *Hub) removeFromRoomLocked(client *Client, room string) {
	if members, ok := h.rooms[room]; ok {
		delete(members, client)
		if len(members) == 0 {
			delete(h.rooms, room)
		}
	}
	delete(client.rooms, room)
}

func (h *Hub) BroadcastToRoom(room string, event []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for client := range h.rooms[room] {
		select {
		case client.send <- event:
		default:
			// client is slow; drop event for it
		}
	}
}

func (h *Hub) BroadcastAll(event []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for client := range h.clients {
		select {
		case client.send <- event:
		default:
			// client is slow; drop event for it
		}
	}
}

func (h *Hub) IsOnline(userID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.presence[userID] > 0
}

func (h *Hub) PresenceMap(userIDs []string) map[string]bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	result := make(map[string]bool, len(userIDs))
	for _, id := range userIDs {
		if id == "" {
			continue
		}
		result[id] = h.presence[id] > 0
	}
	return result
}

func (h *Hub) PublishMessageCreate(event message.CreateEvent) {
	if event.ChannelID != nil {
		h.BroadcastToRoom("channel:"+*event.ChannelID, writeEvent("message:create", event))
		if event.ServerID != "" {
			h.BroadcastToRoom("server:"+event.ServerID, writeEvent("message:create", event))
		}
		return
	}
	if event.ConversationID != nil {
		h.BroadcastToRoom("conversation:"+*event.ConversationID, writeEvent("message:create", event))
		for _, userID := range event.UserIDs {
			if userID != "" {
				h.BroadcastToRoom("user:"+userID, writeEvent("message:create", event))
			}
		}
	}
}

func (h *Hub) PublishMessageDelete(event message.DeleteEvent) {
	if event.ChannelID != nil {
		h.BroadcastToRoom("channel:"+*event.ChannelID, writeEvent("message:delete", event))
		if event.ServerID != "" {
			h.BroadcastToRoom("server:"+event.ServerID, writeEvent("message:delete", event))
		}
		return
	}
	if event.ConversationID != nil {
		h.BroadcastToRoom("conversation:"+*event.ConversationID, writeEvent("message:delete", event))
		for _, userID := range event.UserIDs {
			if userID != "" {
				h.BroadcastToRoom("user:"+userID, writeEvent("message:delete", event))
			}
		}
	}
}

func (h *Hub) PublishChannelCreate(event channel.CreateEvent) {
	h.BroadcastToRoom("server:"+event.ServerID, writeEvent("channel:create", event))
}

func (h *Hub) PublishChannelUpdate(event channel.CreateEvent) {
	h.BroadcastToRoom("server:"+event.ServerID, writeEvent("channel:update", event))
}

func (h *Hub) PublishChannelDelete(event channel.DeleteEvent) {
	h.BroadcastToRoom("server:"+event.ServerID, writeEvent("channel:delete", event))
}

func (h *Hub) PublishServerUpdate(event server.UpdateEvent) {
	h.BroadcastToRoom("server:"+event.ServerID, writeEvent("server:update", event))
}

func (h *Hub) PublishServerDelete(event server.DeleteEvent) {
	h.BroadcastToRoom("server:"+event.ServerID, writeEvent("server:delete", event))
}

func (h *Hub) PublishMemberUpdate(event server.MemberJoinEvent) {
	h.BroadcastToRoom("server:"+event.ServerID, writeEvent("server:member:update", event))
}

func (h *Hub) PublishMemberJoin(event server.MemberJoinEvent) {
	h.BroadcastToRoom("server:"+event.ServerID, writeEvent("server:member:join", event))
}

func (h *Hub) PublishMemberLeave(event server.MemberLeaveEvent) {
	h.BroadcastToRoom("server:"+event.ServerID, writeEvent("server:member:leave", event))
}

// SendToUser delivers an event directly to every connection of a user
// (room "user:<id>"). No-op if the user is offline.
func (h *Hub) SendToUser(userID string, event []byte) {
	h.BroadcastToRoom("user:"+userID, event)
}

// BroadcastToCall broadcasts an event to the call room "call:<id>".
func (h *Hub) BroadcastToCall(callID string, event []byte) {
	h.BroadcastToRoom("call:"+callID, event)
}

func (h *Hub) PublishFriendRequest(recipientID string, requester *user.User) {
	h.publishFriendEvent("friend:request", recipientID, requester)
}

func (h *Hub) PublishFriendAccepted(requesterID string, friend *user.User) {
	h.publishFriendEvent("friend:request:accepted", requesterID, friend)
}

func (h *Hub) PublishFriendDeclined(requesterID string, declined *user.User) {
	h.publishFriendEvent("friend:request:declined", requesterID, declined)
}

func (h *Hub) PublishFriendCancelled(recipientID string, requester *user.User) {
	h.publishFriendEvent("friend:request:cancelled", recipientID, requester)
}

func (h *Hub) PublishFriendRemoved(recipientID string, removed *user.User) {
	h.publishFriendEvent("friend:removed", recipientID, removed)
}

func (h *Hub) publishFriendEvent(eventType string, recipientID string, target *user.User) {
	if recipientID == "" || target == nil {
		return
	}
	h.BroadcastToRoom("user:"+recipientID, writeEvent(eventType, map[string]interface{}{
		"user_id": target.ID,
		"user":    target,
	}))
}
