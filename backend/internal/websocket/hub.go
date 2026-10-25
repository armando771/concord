package websocket

import (
	"context"
	"log"
	"sync"
	"time"

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
	statuses     map[string]string // status escolhido (online, idle, dnd, invisible)
	statusLookup StatusLookup
	onDisconnect func(userID string)
}

// StatusLookup lê do banco o status escolhido por quem acabou de conectar.
type StatusLookup func(ctx context.Context, userID string) (string, error)

func NewHub() *Hub {
	return &Hub{
		clients:  make(map[*Client]struct{}),
		rooms:    make(map[string]map[*Client]struct{}),
		presence: make(map[string]int),
		statuses: make(map[string]string),
	}
}

func (h *Hub) SetStatusLookup(fn StatusLookup) {
	h.mu.Lock()
	h.statusLookup = fn
	h.mu.Unlock()
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
	lookup := h.statusLookup
	h.mu.Unlock()

	if !wasOffline {
		return
	}
	status := user.StatusOnline
	if lookup != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		if stored, err := lookup(ctx, client.userID); err == nil {
			status = stored
		} else {
			log.Printf("[ws] status lookup for %s: %v", client.userID, err)
		}
		cancel()
	}
	h.mu.Lock()
	h.statuses[client.userID] = status
	h.mu.Unlock()

	// Invisível conecta sem ninguém ficar sabendo.
	if status != user.StatusInvisible {
		h.broadcastPresence(client.userID, user.EffectiveStatus(status, true))
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
		delete(h.statuses, client.userID)
		wasOnline = true
	}
	h.mu.Unlock()

	if wasOnline && h.onDisconnect != nil {
		h.onDisconnect(client.userID)
	}

	if wasOnline {
		h.broadcastPresence(client.userID, user.StatusOffline)
	}
}

// broadcastPresence avisa todo mundo do status efetivo. "online" continua no
// evento para quem só quer saber se está conectado.
func (h *Hub) broadcastPresence(userID, status string) {
	h.BroadcastAll(writeEvent("presence:update", map[string]interface{}{
		"user_id": userID,
		"online":  status != user.StatusOffline,
		"status":  status,
	}))
}

// effectiveStatusLocked: precisa de h.mu (leitura).
func (h *Hub) effectiveStatusLocked(userID string) string {
	connected := h.presence[userID] > 0
	status, ok := h.statuses[userID]
	if !ok {
		status = user.StatusOnline
	}
	return user.EffectiveStatus(status, connected)
}

// EffectiveStatus é o status que os outros veem (offline se desconectado ou
// invisível).
func (h *Hub) EffectiveStatus(userID string) string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.effectiveStatusLocked(userID)
}

// SetUserStatus guarda o status escolhido e avisa a presença se mudou o que
// os outros veem.
func (h *Hub) SetUserStatus(userID, status string) {
	h.mu.Lock()
	before := h.effectiveStatusLocked(userID)
	h.statuses[userID] = status
	after := h.effectiveStatusLocked(userID)
	h.mu.Unlock()

	if before != after {
		h.broadcastPresence(userID, after)
	}
}

// PublishUserUpdate manda o perfil novo (nome, avatar, banner, bio...) para
// todo mundo, como a presença.
func (h *Hub) PublishUserUpdate(profile user.PublicProfile) {
	h.BroadcastAll(writeEvent("user:update", map[string]interface{}{
		"user": profile,
	}))
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

// BroadcastToRoomsExcept entrega o evento uma vez por conexão presente em
// qualquer das salas, pulando as conexões de exceptUserID.
func (h *Hub) BroadcastToRoomsExcept(rooms []string, exceptUserID string, event []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	// Uma sala só (canal) não tem como repetir conexão.
	var sent map[*Client]struct{}
	if len(rooms) > 1 {
		sent = make(map[*Client]struct{})
	}
	for _, room := range rooms {
		for client := range h.rooms[room] {
			if client.userID == exceptUserID {
				continue
			}
			if sent != nil {
				if _, ok := sent[client]; ok {
					continue
				}
				sent[client] = struct{}{}
			}
			select {
			case client.send <- event:
			default:
				// client is slow; drop event for it
			}
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

// PresenceMap devolve o status efetivo de cada id ("offline" se desconectado
// ou invisível).
func (h *Hub) PresenceMap(userIDs []string) map[string]string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	result := make(map[string]string, len(userIDs))
	for _, id := range userIDs {
		if id == "" {
			continue
		}
		result[id] = h.effectiveStatusLocked(id)
	}
	return result
}

// messageRooms são as salas por onde chegam message:create e message:delete:
// o canal e o servidor dele, ou a DM e a sala pessoal de cada participante.
func messageRooms(channelID *string, serverID string, conversationID *string, userIDs []string) []string {
	var rooms []string
	if channelID != nil {
		rooms = append(rooms, "channel:"+*channelID)
		if serverID != "" {
			rooms = append(rooms, "server:"+serverID)
		}
		return rooms
	}
	if conversationID != nil {
		rooms = append(rooms, "conversation:"+*conversationID)
		for _, userID := range userIDs {
			if userID != "" {
				rooms = append(rooms, "user:"+userID)
			}
		}
	}
	return rooms
}

func (h *Hub) PublishMessageCreate(event message.CreateEvent) {
	data := writeEvent("message:create", event)
	for _, room := range messageRooms(event.ChannelID, event.ServerID, event.ConversationID, event.UserIDs) {
		h.BroadcastToRoom(room, data)
	}
}

func (h *Hub) PublishMessageDelete(event message.DeleteEvent) {
	data := writeEvent("message:delete", event)
	for _, room := range messageRooms(event.ChannelID, event.ServerID, event.ConversationID, event.UserIDs) {
		h.BroadcastToRoom(room, data)
	}
}

// PublishPollUpdate vai só para a sala da conversa/canal: quem não está com a
// sala aberta recebe a enquete atualizada ao carregar as mensagens.
func (h *Hub) PublishPollUpdate(event message.PollUpdateEvent) {
	if event.ChannelID != nil {
		h.BroadcastToRoom("channel:"+*event.ChannelID, writeEvent("message:poll:update", event))
		return
	}
	if event.ConversationID != nil {
		h.BroadcastToRoom("conversation:"+*event.ConversationID, writeEvent("message:poll:update", event))
	}
}

func (h *Hub) PublishReactionAdd(event message.ReactionEvent) {
	if event.ChannelID != nil {
		h.BroadcastToRoom("channel:"+*event.ChannelID, writeEvent("message:reaction:add", event))
		return
	}
	if event.ConversationID != nil {
		h.BroadcastToRoom("conversation:"+*event.ConversationID, writeEvent("message:reaction:add", event))
	}
}

func (h *Hub) PublishReactionRemove(event message.ReactionEvent) {
	if event.ChannelID != nil {
		h.BroadcastToRoom("channel:"+*event.ChannelID, writeEvent("message:reaction:remove", event))
		return
	}
	if event.ConversationID != nil {
		h.BroadcastToRoom("conversation:"+*event.ConversationID, writeEvent("message:reaction:remove", event))
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

func (h *Hub) PublishChannelReorder(event channel.ReorderEvent) {
	h.BroadcastToRoom("server:"+event.ServerID, writeEvent("channel:reorder", event))
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
