package websocket

import "testing"

func TestUnsubscribeUserLeavesOthersInRoom(t *testing.T) {
	h := NewHub()
	desktop, web := newTestClient(h, "ana"), newTestClient(h, "ana")
	bia := newTestClient(h, "bia")
	for _, c := range []*Client{desktop, web, bia} {
		h.Subscribe(c, "call:c1")
	}
	h.Subscribe(desktop, "server:s1")

	h.UnsubscribeUser("ana", "call:c1")
	h.BroadcastToCall("c1", []byte(`{"type":"call:left"}`))

	if len(desktop.send) != 0 || len(web.send) != 0 {
		t.Fatalf("as conexões da ana ainda recebem a sala: desktop=%d web=%d", len(desktop.send), len(web.send))
	}
	if len(bia.send) != 1 {
		t.Fatalf("bia recebeu %d eventos, quer 1", len(bia.send))
	}
	if _, ok := desktop.rooms["call:c1"]; ok {
		t.Fatal("a conexão ainda lista a sala")
	}
	if _, ok := desktop.rooms["server:s1"]; !ok {
		t.Fatal("as outras salas da ana não podem mudar")
	}
}
