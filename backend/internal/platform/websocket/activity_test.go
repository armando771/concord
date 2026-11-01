package websocket

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"gin-quickstart/backend/internal/user"
)

type fakeAudience map[string][]string

func (f fakeAudience) Audience(_ context.Context, id string) ([]string, error) {
	return f[id], nil
}

type activityEvent struct {
	Type    string `json:"type"`
	Payload struct {
		UserID    string     `json:"user_id"`
		Activity  *Activity  `json:"activity"`
		Listening *Listening `json:"listening"`
	} `json:"payload"`
}

// subscribeUser põe c na sala pessoal, como o app faz ao conectar.
func subscribeUser(h *Hub, c *Client, id string) {
	h.Subscribe(c, "user:"+id)
}

func drainActivity(t *testing.T, c *Client) []activityEvent {
	t.Helper()
	var events []activityEvent
	for {
		select {
		case raw := <-c.send:
			var ev activityEvent
			if err := json.Unmarshal(raw, &ev); err != nil {
				t.Fatal(err)
			}
			if ev.Type == "presence:activity" {
				events = append(events, ev)
			}
		default:
			return events
		}
	}
}

func setGame(h *Hub, id, name string) {
	h.HandleActivity(id, "activity:set", json.RawMessage(`{"name":"`+name+`","kind":"game"}`))
}

func activityHub() (*Hub, *Client, *Client, *Client) {
	h := NewHub()
	h.SetAudience(fakeAudience{"a": {"friend"}, "friend": {"a"}})
	a, friend, stranger := newTestClient(h, "a"), newTestClient(h, "friend"), newTestClient(h, "stranger")
	for _, c := range []*Client{a, friend, stranger} {
		h.Register(c)
		subscribeUser(h, c, c.userID)
	}
	return h, a, friend, stranger
}

func TestActivityGoesOnlyToAudienceAndSelf(t *testing.T) {
	h, a, friend, stranger := activityHub()
	setGame(h, "a", "VALORANT")

	for name, c := range map[string]*Client{"self": a, "friend": friend} {
		evs := drainActivity(t, c)
		if len(evs) != 1 || evs[0].Payload.Activity == nil || evs[0].Payload.Activity.Name != "VALORANT" {
			t.Fatalf("%s: eventos = %+v", name, evs)
		}
	}
	if evs := drainActivity(t, stranger); len(evs) != 0 {
		t.Fatalf("estranho recebeu atividade: %+v", evs)
	}
}

func TestActivityClearedOnLastDisconnect(t *testing.T) {
	h, a, friend, _ := activityHub()
	setGame(h, "a", "VALORANT")
	drainActivity(t, friend)

	h.Unregister(a)
	evs := drainActivity(t, friend)
	if len(evs) != 1 || evs[0].Payload.Activity != nil {
		t.Fatalf("esperava limpar a atividade, veio %+v", evs)
	}
}

func TestActivityInvalidInputIgnored(t *testing.T) {
	h, _, friend, _ := activityHub()
	h.HandleActivity("a", "activity:set", json.RawMessage(`{"name":"","kind":"game"}`))
	h.HandleActivity("a", "activity:set", json.RawMessage(`{"name":"x","kind":"hack"}`))
	h.HandleActivity("a", "activity:set", json.RawMessage(`nope`))
	long := make([]byte, 80)
	for i := range long {
		long[i] = 'x'
	}
	setGame(h, "a", string(long))
	if evs := drainActivity(t, friend); len(evs) != 0 {
		t.Fatalf("entrada inválida publicou: %+v", evs)
	}
}

func TestActivityHiddenWhileInvisible(t *testing.T) {
	h, _, friend, _ := activityHub()
	setGame(h, "a", "VALORANT")
	drainActivity(t, friend)

	h.SetUserStatus("a", user.StatusInvisible)
	if evs := drainActivity(t, friend); len(evs) != 1 || evs[0].Payload.Activity != nil {
		t.Fatalf("invisível devia limpar: %+v", evs)
	}
	got := h.ActivitiesFor(context.Background(), "friend", []string{"a"})
	if len(got) != 0 {
		t.Fatalf("invisível apareceu na carga: %+v", got)
	}

	h.SetUserStatus("a", user.StatusOnline)
	if evs := drainActivity(t, friend); len(evs) != 1 || evs[0].Payload.Activity == nil {
		t.Fatalf("voltar devia republicar: %+v", evs)
	}
}

func TestActivitiesForFiltersByAudience(t *testing.T) {
	h, _, _, _ := activityHub()
	setGame(h, "a", "VALORANT")

	got := h.ActivitiesFor(context.Background(), "friend", []string{"a", "stranger"})
	if len(got) != 1 || got["a"].Name != "VALORANT" {
		t.Fatalf("amigo devia ver: %+v", got)
	}
	if got := h.ActivitiesFor(context.Background(), "stranger", []string{"a"}); len(got) != 0 {
		t.Fatalf("estranho viu atividade: %+v", got)
	}
}

func TestActivityRateLimitedPerUser(t *testing.T) {
	h, _, friend, _ := activityHub()
	setGame(h, "a", "VALORANT")
	setGame(h, "a", "PUBG")
	if evs := drainActivity(t, friend); len(evs) != 1 {
		t.Fatalf("troca imediata devia ser ignorada: %+v", evs)
	}
}

const testIconHash = "0e56e01c18bf303a65ba60dddfa842cc85d1da33"

func TestActivityCarriesSteamAppID(t *testing.T) {
	h, _, friend, _ := activityHub()
	h.HandleActivity("a", "activity:set", json.RawMessage(`{"name":"Grounded 2","kind":"game","app_id":2661300,"icon_hash":"`+testIconHash+`"}`))
	evs := drainActivity(t, friend)
	if len(evs) != 1 || evs[0].Payload.Activity == nil || evs[0].Payload.Activity.AppID != 2661300 ||
		evs[0].Payload.Activity.IconHash != testIconHash {
		t.Fatalf("app_id não chegou ao amigo: %+v", evs)
	}
}

func TestActivityInvalidAppIDDropped(t *testing.T) {
	cases := []string{
		`"app_id":-5,"icon_hash":"` + testIconHash + `"`,
		`"app_id":99999999999,"icon_hash":"` + testIconHash + `"`,
		`"app_id":730,"icon_hash":"../../x"`,
		`"app_id":730`,
	}
	for _, raw := range cases {
		h, _, friend, _ := activityHub()
		h.HandleActivity("a", "activity:set", json.RawMessage(`{"name":"Jogo","kind":"game",`+raw+`}`))
		evs := drainActivity(t, friend)
		if len(evs) != 1 || evs[0].Payload.Activity.AppID != 0 || evs[0].Payload.Activity.IconHash != "" {
			t.Fatalf("%s deveria perder o ícone: %+v", raw, evs)
		}
	}
}

func TestActivitySameGameNotRepublished(t *testing.T) {
	h, _, friend, _ := activityHub()
	setGame(h, "a", "VALORANT")
	drainActivity(t, friend)

	// Passado o limite de trocas, o mesmo jogo não avisa ninguém; outro, sim.
	h.mu.Lock()
	h.rich.games.setAt["a"] = time.Now().Add(-2 * activityMinInterval)
	h.mu.Unlock()
	setGame(h, "a", "VALORANT")
	if evs := drainActivity(t, friend); len(evs) != 0 {
		t.Fatalf("mesmo jogo republicado: %+v", evs)
	}
	h.mu.Lock()
	h.rich.games.setAt["a"] = time.Now().Add(-2 * activityMinInterval)
	h.mu.Unlock()
	setGame(h, "a", "PUBG")
	if evs := drainActivity(t, friend); len(evs) != 1 {
		t.Fatalf("troca de jogo devia publicar: %+v", evs)
	}
}
