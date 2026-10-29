package call

import (
	"context"
	"os"
	"slices"
	"strings"
	"testing"
	"time"

	"gin-quickstart/backend/internal/platform/livekit"

	lksdk "github.com/livekit/server-sdk-go/v2"
)

// Ponta a ponta com um LiveKit de verdade (#374): quem não está na sala sai da
// call; quem está fica; o bot de música não atrapalha. Só roda com
// CALL_LIVEKIT_TEST_URL (ws://...), CALL_LIVEKIT_TEST_KEY e _SECRET.
func TestLiveKitLocalMediaPresence(t *testing.T) {
	wsURL := os.Getenv("CALL_LIVEKIT_TEST_URL")
	if wsURL == "" {
		t.Skip("CALL_LIVEKIT_TEST_URL não definido")
	}
	key, secret := os.Getenv("CALL_LIVEKIT_TEST_KEY"), os.Getenv("CALL_LIVEKIT_TEST_SECRET")
	room := "fantasma-" + time.Now().Format("150405.000")
	tokens := livekit.NewTokenIssuer(key, secret)
	admin := livekit.NewAdmin(strings.Replace(wsURL, "ws", "http", 1), key, secret)

	join := func(identity string, bot bool) *lksdk.Room {
		t.Helper()
		token, err := tokens.Issue(room, identity, identity, livekit.Grant{})
		if bot {
			token, err = tokens.IssueBot(room, identity, "Maestro")
		}
		if err != nil {
			t.Fatal(err)
		}
		r, err := lksdk.ConnectToRoomWithToken(wsURL, token, lksdk.NewRoomCallback())
		if err != nil {
			t.Fatalf("%s não entrou na sala: %v", identity, err)
		}
		return r
	}
	ana := join("ana", false)
	bot := join("bot-music:canal-1", true)
	defer bot.Disconnect()

	s := serviceWithCall(room, "ana", "bia")
	_, left := recordLeaves(s)
	clock := time.Now()
	presence := NewMediaPresence(s, admin, func() time.Time { return clock })
	route := presence.Router(s)
	ctx := context.Background()

	// bia: app reabriu e não voltou (nunca conectou à mídia). ana: outro
	// aparelho diz "não estou", mas ela está na sala.
	route.HandleCallMessage("bia", "call:presence", []byte(`{"call_id":null}`))
	route.HandleCallMessage("ana", "call:presence", []byte(`{"call_id":null}`))
	if !slices.Equal(*left, []string{room + "/bia"}) {
		t.Fatalf("saídas = %v, want só bia", *left)
	}

	// ana sai da mídia (fecha o app): a varredura a tira.
	presence.Sweep(ctx)
	ana.Disconnect()
	deadline := time.Now().Add(15 * time.Second)
	for {
		ids, err := admin.Identities(ctx, room)
		if err != nil {
			t.Fatal(err)
		}
		if !slices.Contains(ids, "ana") {
			if !slices.Contains(ids, "bot-music:canal-1") {
				t.Fatalf("o bot sumiu da sala: %v", ids)
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("ana continua na sala: %v", ids)
		}
		time.Sleep(200 * time.Millisecond)
	}
	clock = clock.Add(MediaJoinGrace)
	presence.Sweep(ctx)
	if !slices.Equal(*left, []string{room + "/bia", room + "/ana"}) {
		t.Fatalf("saídas = %v, want bia e ana", *left)
	}
}
