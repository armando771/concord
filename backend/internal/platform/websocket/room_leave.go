package websocket

// UnsubscribeUser tira todas as conexões do usuário da sala (ex.: quem um
// moderador move de canal de voz sai da sala da chamada antiga antes de os
// outros receberem a saída dele).
func (h *Hub) UnsubscribeUser(userID, room string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for client := range h.rooms[room] {
		if client.userID == userID {
			h.removeFromRoomLocked(client, room)
		}
	}
}
