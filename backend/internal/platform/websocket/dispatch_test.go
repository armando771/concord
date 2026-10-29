package websocket

import (
	"context"
	"encoding/json"
	"testing"
)

type recordingTyping struct{ got []string }

func (r *recordingTyping) Handle(_ context.Context, userID, evType string, _ json.RawMessage) {
	r.got = append(r.got, userID+" "+evType)
}

func newDispatchClient(validator subscribeValidator) *Client {
	return &Client{hub: NewHub(), userID: "ana", rooms: map[string]struct{}{}, validator: validator}
}

func event(typ, payload string) inboundEvent {
	return inboundEvent{Type: typ, Payload: json.RawMessage(payload)}
}

func TestDispatchSubscribeChecksRoomAndAccess(t *testing.T) {
	allowOnly := func(_ context.Context, _ string, channelID, _, _, _, _ string) bool { return channelID == "c1" }
	c := newDispatchClient(allowOnly)
	ctx := context.Background()

	c.dispatch(ctx, event("subscribe", `{"room":"channel:c1"}`))
	c.dispatch(ctx, event("subscribe", `{"room":"channel:c2"}`))     // sem acesso
	c.dispatch(ctx, event("subscribe", `{"room":"qualquer:coisa"}`)) // sala que não existe
	c.dispatch(ctx, event("subscribe", `"lixo"`))                    // payload inválido

	if len(c.rooms) != 1 {
		t.Fatalf("salas = %v, want só channel:c1", c.rooms)
	}
	if _, ok := c.rooms["channel:c1"]; !ok {
		t.Fatalf("salas = %v, want channel:c1", c.rooms)
	}

	c.dispatch(ctx, event("unsubscribe", `"lixo"`))
	c.dispatch(ctx, event("unsubscribe", `{"room":"channel:c1"}`))
	if len(c.rooms) != 0 {
		t.Fatalf("depois de sair, salas = %v", c.rooms)
	}
}

func TestDispatchSubscribeWithoutValidator(t *testing.T) {
	c := newDispatchClient(nil)
	c.dispatch(context.Background(), event("subscribe", `{"room":"call:x"}`))
	if _, ok := c.rooms["call:x"]; !ok {
		t.Fatalf("salas = %v, want call:x", c.rooms)
	}
}

func TestDispatchRoutesTypingAndIgnoresUnknown(t *testing.T) {
	typing := &recordingTyping{}
	router := &recordingRouter{events: make(chan routedEvent, 5)}
	c := newDispatchClient(nil)
	c.typing = typing
	c.callRouter = router
	ctx := context.Background()

	c.dispatch(ctx, event("typing", `{}`))
	c.dispatch(ctx, event("typing:stop", `{}`))
	c.dispatch(ctx, event("call:qualquer", `{}`)) // não é mensagem de chamada
	c.dispatch(ctx, event("call:leave", `{}`))
	c.dispatch(ctx, event("call:speaking", `{"call_id":"c1"}`))
	c.dispatch(ctx, event("call:presence", `{"call_id":null}`))

	if len(typing.got) != 2 || typing.got[0] != "ana typing" {
		t.Fatalf("digitação = %v", typing.got)
	}
	if len(router.events) != 3 {
		t.Fatalf("repassadas ao call = %d, want 3 (call:leave, call:speaking e call:presence)", len(router.events))
	}

	// Sem roteadores ligados, nada quebra.
	bare := newDispatchClient(nil)
	bare.dispatch(ctx, event("typing", `{}`))
	bare.dispatch(ctx, event("call:leave", `{}`))
}
