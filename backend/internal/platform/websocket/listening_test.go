package websocket

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"gin-quickstart/backend/internal/user"
)

func setListening(h *Hub, id, raw string) {
	h.HandleActivity(id, "activity:set", json.RawMessage(`{"kind":"listening",`+raw+`}`))
}

const spotifyTrack = `"app":"Spotify","title":"Águas de Março","artist":"Elis Regina","album":"Elis & Tom","position_ms":83000,"duration_ms":225000`

func TestListeningGoesToAudienceWithStartFromPosition(t *testing.T) {
	h, _, friend, stranger := activityHub()
	before := time.Now().UnixMilli()
	setListening(h, "a", spotifyTrack)

	evs := drainActivity(t, friend)
	if len(evs) != 1 || evs[0].Payload.Listening == nil || evs[0].Payload.Activity != nil {
		t.Fatalf("amigo devia receber só a música: %+v", evs)
	}
	l := evs[0].Payload.Listening
	if l.App != "Spotify" || l.Title != "Águas de Março" || l.Artist != "Elis Regina" ||
		l.Album != "Elis & Tom" || l.DurationMs != 225000 {
		t.Fatalf("campos da música = %+v", l)
	}
	// Início = agora (no servidor) - posição.
	if l.StartedAt < before-83000 || l.StartedAt > time.Now().UnixMilli()-83000 {
		t.Fatalf("started_at = %d, quer ~%d", l.StartedAt, before-83000)
	}
	if evs := drainActivity(t, stranger); len(evs) != 0 {
		t.Fatalf("estranho recebeu música: %+v", evs)
	}
}

func TestListeningAndGameCoexist(t *testing.T) {
	h, _, friend, _ := activityHub()
	setGame(h, "a", "VALORANT")
	setListening(h, "a", spotifyTrack)

	evs := drainActivity(t, friend)
	if len(evs) != 2 {
		t.Fatalf("esperava 2 eventos (tipos com limites separados), veio %+v", evs)
	}
	last := evs[1].Payload
	if last.Activity == nil || last.Activity.Name != "VALORANT" || last.Listening == nil {
		t.Fatalf("o evento leva jogo e música juntos: %+v", last)
	}
}

func TestActivityClearByKind(t *testing.T) {
	h, _, friend, _ := activityHub()
	setGame(h, "a", "VALORANT")
	setListening(h, "a", spotifyTrack)
	drainActivity(t, friend)

	h.HandleActivity("a", "activity:clear", json.RawMessage(`{"kind":"listening"}`))
	evs := drainActivity(t, friend)
	if len(evs) != 1 || evs[0].Payload.Listening != nil || evs[0].Payload.Activity == nil {
		t.Fatalf("limpar a música não pode limpar o jogo: %+v", evs)
	}

	// App antigo manda activity:clear sem tipo: é o jogo.
	h.HandleActivity("a", "activity:clear", json.RawMessage(`{}`))
	evs = drainActivity(t, friend)
	if len(evs) != 1 || evs[0].Payload.Activity != nil {
		t.Fatalf("clear sem tipo devia limpar o jogo: %+v", evs)
	}
}

func TestListeningInvalidInputIgnored(t *testing.T) {
	long := strings.Repeat("x", 129)
	cases := map[string]string{
		"sem título":         `"app":"Spotify","title":"  "`,
		"sem app":            `"app":"","title":"Música"`,
		"título longo":       `"app":"Spotify","title":"` + long + `"`,
		"artista longo":      `"app":"Spotify","title":"Música","artist":"` + long + `"`,
		"álbum longo":        `"app":"Spotify","title":"Música","album":"` + long + `"`,
		"app longo":          `"app":"` + strings.Repeat("x", 65) + `","title":"Música"`,
		"título não é texto": `"app":"Spotify","title":5`,
	}
	for name, raw := range cases {
		h, _, friend, _ := activityHub()
		setListening(h, "a", raw)
		if evs := drainActivity(t, friend); len(evs) != 0 {
			t.Fatalf("%s: entrada inválida publicou %+v", name, evs)
		}
	}
}

func TestListeningClampsDurationAndPosition(t *testing.T) {
	tests := []struct {
		name         string
		raw          string
		wantDuration int64
		wantPosition int64
	}{
		{"duração negativa vira desconhecida", `"position_ms":1000,"duration_ms":-5`, 0, 1000},
		{"duração de mais de um dia vira desconhecida", `"position_ms":1000,"duration_ms":90000000000`, 0, 1000},
		{"posição negativa vira zero", `"position_ms":-300,"duration_ms":200000`, 200000, 0},
		{"posição depois do fim fica no fim", `"position_ms":999000,"duration_ms":200000`, 200000, 200000},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h, _, friend, _ := activityHub()
			now := time.Now().UnixMilli()
			setListening(h, "a", `"app":"Spotify","title":"Música",`+tt.raw)
			evs := drainActivity(t, friend)
			if len(evs) != 1 || evs[0].Payload.Listening == nil {
				t.Fatalf("eventos = %+v", evs)
			}
			l := evs[0].Payload.Listening
			if l.DurationMs != tt.wantDuration {
				t.Errorf("duration_ms = %d, quer %d", l.DurationMs, tt.wantDuration)
			}
			if pos := now - l.StartedAt; pos < tt.wantPosition-50 || pos > tt.wantPosition+50 {
				t.Errorf("posição = %d, quer %d", pos, tt.wantPosition)
			}
		})
	}
}

func TestListeningSameTrackNotRepublished(t *testing.T) {
	h, _, friend, _ := activityHub()
	setListening(h, "a", spotifyTrack)
	drainActivity(t, friend)

	// Passado o limite de trocas, a mesma faixa na mesma posição não avisa ninguém.
	h.mu.Lock()
	h.rich.listening.setAt["a"] = time.Now().Add(-2 * activityMinInterval)
	h.mu.Unlock()
	setListening(h, "a", spotifyTrack)
	if evs := drainActivity(t, friend); len(evs) != 0 {
		t.Fatalf("mesma faixa republicada: %+v", evs)
	}

	// Pulou para outro ponto da faixa (seek): avisa.
	h.mu.Lock()
	h.rich.listening.setAt["a"] = time.Now().Add(-2 * activityMinInterval)
	h.mu.Unlock()
	setListening(h, "a", strings.Replace(spotifyTrack, `"position_ms":83000`, `"position_ms":150000`, 1))
	if evs := drainActivity(t, friend); len(evs) != 1 {
		t.Fatalf("seek devia republicar: %+v", evs)
	}
}

func TestListeningHiddenWhileInvisibleAndClearedOnDisconnect(t *testing.T) {
	h, a, friend, _ := activityHub()
	setListening(h, "a", spotifyTrack)
	drainActivity(t, friend)

	h.SetUserStatus("a", user.StatusInvisible)
	evs := drainActivity(t, friend)
	if len(evs) != 1 || evs[0].Payload.Listening != nil {
		t.Fatalf("invisível devia esconder a música: %+v", evs)
	}
	if got := h.ActivitiesFor(context.Background(), "friend", []string{"a"}); len(got) != 0 {
		t.Fatalf("invisível apareceu na carga: %+v", got)
	}

	h.SetUserStatus("a", user.StatusOnline)
	if evs := drainActivity(t, friend); len(evs) != 1 || evs[0].Payload.Listening == nil {
		t.Fatalf("voltar devia republicar a música: %+v", evs)
	}

	h.Unregister(a)
	if evs := drainActivity(t, friend); len(evs) != 1 || evs[0].Payload.Listening != nil {
		t.Fatalf("sair devia limpar a música: %+v", evs)
	}
}

func TestActivitiesForCarriesListeningWithoutGame(t *testing.T) {
	h, _, _, _ := activityHub()
	setListening(h, "a", spotifyTrack)

	got := h.ActivitiesFor(context.Background(), "friend", []string{"a"})
	raw, err := json.Marshal(got)
	if err != nil {
		t.Fatal(err)
	}
	var decoded map[string]map[string]json.RawMessage
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	entry := decoded["a"]
	// Apps antigos leem o jogo nos campos de cima: sem jogo, nada de "name".
	if _, hasName := entry["name"]; hasName || entry["listening"] == nil {
		t.Fatalf("formato da carga = %s", raw)
	}
}
