package websocket

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

	"gin-quickstart/backend/internal/message"
	"gin-quickstart/backend/internal/user"
)

// fakeRoomAccess libera escrita para quem estiver em allowed[sala].
type fakeRoomAccess struct {
	allowed map[string]map[string]bool
	calls   int
}

func (f *fakeRoomAccess) key(room message.Room) string {
	if room.ChannelID != "" {
		return "channel:" + room.ChannelID
	}
	return "conversation:" + room.ConversationID
}

func (f *fakeRoomAccess) CanRead(ctx context.Context, room message.Room, userID string) error {
	return f.CanWrite(ctx, room, userID)
}

func (f *fakeRoomAccess) CanWrite(_ context.Context, room message.Room, userID string) error {
	f.calls++
	if f.allowed[f.key(room)][userID] {
		return nil
	}
	return message.ErrNoRoomAccess
}

type fakeParticipants map[string][]string

func (f fakeParticipants) ConversationParticipantIDs(_ context.Context, id string) ([]string, error) {
	ids, ok := f[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return ids, nil
}

type typingEvent struct {
	Type    string `json:"type"`
	Payload struct {
		Room        string `json:"room"`
		UserID      string `json:"user_id"`
		DisplayName string `json:"display_name"`
	} `json:"payload"`
}

func typingEvents(t *testing.T, c *Client) []typingEvent {
	t.Helper()
	var events []typingEvent
	for {
		select {
		case raw := <-c.send:
			var ev typingEvent
			if err := json.Unmarshal(raw, &ev); err != nil {
				t.Fatal(err)
			}
			if ev.Type == "typing" || ev.Type == "typing:stop" {
				events = append(events, ev)
			}
		default:
			return events
		}
	}
}

type typingFixture struct {
	hub    *Hub
	typing *Typing
	access *fakeRoomAccess
	now    time.Time
}

func newTypingFixture() *typingFixture {
	f := &typingFixture{
		hub: NewHub(),
		access: &fakeRoomAccess{allowed: map[string]map[string]bool{
			"channel:c1":      {"ana": true, "bia": true, "caio": true},
			"conversation:d1": {"ana": true, "bia": true},
		}},
		now: time.Unix(1_700_000_000, 0),
	}
	users := map[string]*user.User{
		"ana":  {ID: "ana", Username: "ana", DisplayName: "Ana"},
		"bia":  {ID: "bia", Username: "bia", DisplayName: "Bia"},
		"caio": {ID: "caio", Username: "caio"},
	}
	lookup := func(_ context.Context, id string) (*user.User, error) {
		if u, ok := users[id]; ok {
			return u, nil
		}
		return nil, errors.New("not found")
	}
	f.typing = NewTyping(f.hub, f.access, fakeParticipants{"d1": {"ana", "bia"}}, lookup)
	f.typing.now = func() time.Time { return f.now }
	return f
}

// join cria uma conexão de userID já dentro das salas.
func (f *typingFixture) join(userID string, rooms ...string) *Client {
	c := newTestClient(f.hub, userID)
	f.hub.Register(c)
	for _, room := range rooms {
		f.hub.Subscribe(c, room)
	}
	for len(c.send) > 0 {
		<-c.send
	}
	return c
}

func (f *typingFixture) send(userID, evType, room string) {
	payload, _ := json.Marshal(map[string]string{"room": room})
	f.typing.Handle(context.Background(), userID, evType, payload)
}

func TestTypingReachesChannelViewersExceptSender(t *testing.T) {
	f := newTypingFixture()
	ana := f.join("ana", "channel:c1", "server:s1")
	anaOther := f.join("ana", "channel:c1") // outra aba/dispositivo da Ana
	bia := f.join("bia", "channel:c1", "server:s1")
	caioOtherChannel := f.join("caio", "server:s1")

	f.send("ana", "typing", "channel:c1")

	if got := typingEvents(t, ana); len(got) != 0 {
		t.Fatalf("quem digita não recebe o próprio evento: %+v", got)
	}
	if got := typingEvents(t, anaOther); len(got) != 0 {
		t.Fatalf("outra conexão de quem digita também não: %+v", got)
	}
	got := typingEvents(t, bia)
	if len(got) != 1 {
		t.Fatalf("bia recebeu %d eventos (sala do canal e do servidor não podem duplicar)", len(got))
	}
	p := got[0].Payload
	if got[0].Type != "typing" || p.Room != "channel:c1" || p.UserID != "ana" || p.DisplayName != "Ana" {
		t.Fatalf("evento = %+v", got[0])
	}
	if got := typingEvents(t, caioOtherChannel); len(got) != 0 {
		t.Fatalf("quem só está com o servidor aberto não recebe: %+v", got)
	}
}

func TestTypingInConversationReachesParticipantRooms(t *testing.T) {
	f := newTypingFixture()
	bia := f.join("bia", "conversation:d1", "user:bia")
	biaElsewhere := f.join("bia", "user:bia") // outra aba, com a DM fechada
	anaSelf := f.join("ana", "user:ana")

	f.send("ana", "typing", "conversation:d1")

	if got := typingEvents(t, bia); len(got) != 1 || got[0].Payload.Room != "conversation:d1" {
		t.Fatalf("bia na DM recebeu %+v", got)
	}
	if got := typingEvents(t, biaElsewhere); len(got) != 1 {
		t.Fatalf("a sala pessoal também recebe (lista de DMs): %+v", got)
	}
	if got := typingEvents(t, anaSelf); len(got) != 0 {
		t.Fatalf("a sala pessoal de quem digita não recebe: %+v", got)
	}
}

func TestTypingWithoutAccessIsDropped(t *testing.T) {
	f := newTypingFixture()
	bia := f.join("bia", "channel:c1", "conversation:d1", "user:bia")

	f.send("intruso", "typing", "channel:c1")
	f.send("caio", "typing", "conversation:d1")

	if got := typingEvents(t, bia); len(got) != 0 {
		t.Fatalf("sem acesso não pode avisar: %+v", got)
	}
}

func TestTypingIgnoresNonChatRooms(t *testing.T) {
	f := newTypingFixture()
	bia := f.join("bia", "server:s1", "user:bia", "call:x")

	for _, room := range []string{"server:s1", "user:bia", "call:x", "qualquer", ""} {
		f.send("ana", "typing", room)
	}

	if got := typingEvents(t, bia); len(got) != 0 {
		t.Fatalf("só canal e DM têm digitando: %+v", got)
	}
	if f.access.calls != 0 {
		t.Fatalf("sala inválida nem chega a consultar acesso (%d)", f.access.calls)
	}
}

func TestTypingFallsBackToUsername(t *testing.T) {
	f := newTypingFixture()
	ana := f.join("ana", "channel:c1")

	f.send("caio", "typing", "channel:c1")

	got := typingEvents(t, ana)
	if len(got) != 1 || got[0].Payload.DisplayName != "caio" {
		t.Fatalf("sem nome de exibição vai o username: %+v", got)
	}
}

func TestTypingIsRateLimitedPerUser(t *testing.T) {
	f := newTypingFixture()
	bia := f.join("bia", "channel:c1", "conversation:d1")

	// Rajada curta passa (typing, stop e typing de novo ao mandar e voltar a
	// digitar); o resto da rajada é descartado.
	for i := 0; i < 5; i++ {
		f.send("ana", "typing", "channel:c1")
	}
	if got := typingEvents(t, bia); len(got) != typingBurst {
		t.Fatalf("rajada: recebeu %d, want %d", len(got), typingBurst)
	}
	if f.access.calls != typingBurst {
		t.Fatalf("descartado nem consulta o banco (%d consultas)", f.access.calls)
	}

	f.send("caio", "typing", "channel:c1")
	if got := typingEvents(t, bia); len(got) != 1 {
		t.Fatalf("o limite é por pessoa: %+v", got)
	}

	// Depois da rajada, cerca de 1 por segundo (canal e DM contam juntos).
	f.now = f.now.Add(1100 * time.Millisecond)
	f.send("ana", "typing", "conversation:d1")
	f.send("ana", "typing:stop", "channel:c1")
	if got := typingEvents(t, bia); len(got) != 1 {
		t.Fatalf("1 por segundo depois da rajada: %+v", got)
	}
	f.now = f.now.Add(500 * time.Millisecond)
	f.send("ana", "typing", "channel:c1")
	if got := typingEvents(t, bia); len(got) != 0 {
		t.Fatalf("meio segundo depois ainda não: %+v", got)
	}
	f.now = f.now.Add(500 * time.Millisecond)
	f.send("ana", "typing", "channel:c1")
	if got := typingEvents(t, bia); len(got) != 1 {
		t.Fatalf("passado o segundo volta a valer: %+v", got)
	}
}

func TestTypingStop(t *testing.T) {
	f := newTypingFixture()
	bia := f.join("bia", "channel:c1")
	ana := f.join("ana", "channel:c1")

	// Digita, apaga tudo e volta a digitar logo em seguida.
	f.send("ana", "typing", "channel:c1")
	f.now = f.now.Add(100 * time.Millisecond)
	f.send("ana", "typing:stop", "channel:c1")
	f.now = f.now.Add(100 * time.Millisecond)
	f.send("ana", "typing", "channel:c1")

	got := typingEvents(t, bia)
	if len(got) != 3 {
		t.Fatalf("typing/stop/typing em sequência chegam todos: %+v", got)
	}
	stop := got[1]
	if stop.Type != "typing:stop" || stop.Payload.Room != "channel:c1" || stop.Payload.UserID != "ana" {
		t.Fatalf("stop = %+v", stop)
	}
	if got := typingEvents(t, ana); len(got) != 0 {
		t.Fatalf("quem parou não recebe o stop: %+v", got)
	}
}

func TestMessageRooms(t *testing.T) {
	ch, conv := "c1", "d1"
	cases := []struct {
		name string
		got  []string
		want []string
	}{
		{"canal com servidor", messageRooms(&ch, "s1", nil, nil), []string{"channel:c1", "server:s1"}},
		{"canal sem servidor", messageRooms(&ch, "", nil, nil), []string{"channel:c1"}},
		{"dm", messageRooms(nil, "", &conv, []string{"ana", "", "bia"}), []string{"conversation:d1", "user:ana", "user:bia"}},
		{"nada", messageRooms(nil, "", nil, nil), nil},
	}
	for _, tc := range cases {
		if !reflect.DeepEqual(tc.got, tc.want) {
			t.Errorf("%s: %v, want %v", tc.name, tc.got, tc.want)
		}
	}
}
