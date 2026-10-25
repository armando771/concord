package websocket

import (
	"context"
	"sync"

	"gin-quickstart/backend/internal/channel"
	"gin-quickstart/backend/internal/message"
	"gin-quickstart/backend/internal/server"
	"gin-quickstart/backend/internal/user"

	"github.com/coder/websocket"
)

// CloseServiceRestart (1012) avisa o app que o servidor está reiniciando: ele
// reconecta logo, sem o backoff normal nem aviso de "reconectando".
const (
	CloseServiceRestart = websocket.StatusServiceRestart
	closeRestartReason  = "servidor reiniciando"
)

type Hub struct {
	mu           sync.RWMutex
	clients      map[*Client]struct{}
	rooms        map[string]map[*Client]struct{}
	presence     map[string]int
	onDisconnect func(userID string)
	// Desligando (deploy): quem cai não "saiu", então nem presença offline
	// nem saída da chamada — o processo novo recarrega tudo.
	shuttingDown bool
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
		wasOnline = !h.shuttingDown
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

// Shutdown fecha todas as conexões com 1012 ("servidor reiniciando") e espera
// os fechamentos até ctx acabar. Chamado no desligamento, depois de o servidor
// HTTP parar de aceitar conexões, para os clientes reconectarem no processo novo.
func (h *Hub) Shutdown(ctx context.Context) {
	h.mu.Lock()
	h.shuttingDown = true
	conns := make([]*websocket.Conn, 0, len(h.clients))
	for client := range h.clients {
		conns = append(conns, client.conn)
	}
	h.mu.Unlock()

	var wg sync.WaitGroup
	for _, conn := range conns {
		wg.Add(1)
		go func(conn *websocket.Conn) {
			defer wg.Done()
			// Close espera o "ok" do cliente (até 5 s); quem não responde cai.
			_ = conn.Close(CloseServiceRestart, closeRestartReason)
		}(conn)
	}
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-ctx.Done():
		for _, conn := range conns {
			_ = conn.CloseNow()
		}
	}
}

// ShuttingDown diz se o servidor já começou a desligar.
func (h *Hub) ShuttingDown() bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.shuttingDown
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
