package guest

import (
	"encoding/json"
)

// CallRouter: quem trata as mensagens de call do WebSocket (call.Service, por
// trás do AFK).
type CallRouter interface {
	HandleCallMessage(userID string, evType string, payload json.RawMessage)
	IsParticipant(callID string, userID string) bool
}

// guestBlocked: o que o visitante não faz na call em que é visitante (o
// servidor recusa, não só a tela): trancar a sala, aceitar quem bate, abrir
// atividade e tocar a mesa de áudio do servidor.
var guestBlocked = map[string]bool{
	"call:lock": true, "call:knock_respond": true,
	"call:activity": true, "call:activity:stop": true,
	"call:soundboard": true,
}

// CallGate filtra as mensagens de call de quem está numa call como visitante.
type CallGate struct {
	next   CallRouter
	guests *Service
}

// Gate põe o filtro de visitante na frente do roteador de call do WebSocket.
func (s *Service) Gate(next CallRouter) *CallGate {
	return &CallGate{next: next, guests: s}
}

func (g *CallGate) HandleCallMessage(userID string, evType string, payload json.RawMessage) {
	if guestBlocked[evType] && g.guests.inGuestCall(userID) {
		g.guests.notify.SendToUser(userID, guestRefusal())
		return
	}
	g.next.HandleCallMessage(userID, evType, payload)
}

func (g *CallGate) IsParticipant(callID string, userID string) bool {
	return g.next.IsParticipant(callID, userID)
}

func guestRefusal() []byte {
	data, _ := json.Marshal(map[string]any{"type": "call:error", "payload": map[string]string{"message": "Visitantes não podem fazer isso na call."}})
	return data
}
