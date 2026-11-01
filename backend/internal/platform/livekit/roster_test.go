package livekit

import (
	"context"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"

	lk "github.com/livekit/protocol/livekit"
)

// Identities: todo mundo na sala, inclusive o bot de música.
func TestIdentitiesListsEveryoneInTheRoom(t *testing.T) {
	srv := httptest.NewServer(lk.NewRoomServiceServer(&fakeRooms{rooms: map[string][]*lk.ParticipantInfo{
		"call-1": {{Identity: "ana"}, {Identity: "bot-music:canal-1"}, {Identity: "visitante"}},
	}}))
	defer srv.Close()

	got, err := NewAdmin(srv.URL, "key", "secret-de-teste-com-tamanho-suficiente").Identities(context.Background(), "call-1")
	if err != nil {
		t.Fatal(err)
	}
	sort.Strings(got)
	if strings.Join(got, ",") != "ana,bot-music:canal-1,visitante" {
		t.Fatalf("identities = %v", got)
	}
}

// Sala que o LiveKit não conhece: ninguém está na mídia.
func TestIdentitiesUnknownRoomIsEmpty(t *testing.T) {
	srv := httptest.NewServer(lk.NewRoomServiceServer(&fakeRooms{rooms: map[string][]*lk.ParticipantInfo{}}))
	defer srv.Close()

	got, err := NewAdmin(srv.URL, "key", "secret-de-teste-com-tamanho-suficiente").Identities(context.Background(), "nada")
	if err != nil || len(got) != 0 {
		t.Fatalf("got %v, %v", got, err)
	}
}

// LiveKit fora do ar é erro (não "ninguém"): quem usa não tira ninguém da call.
func TestIdentitiesUnreachableIsError(t *testing.T) {
	srv := httptest.NewServer(lk.NewRoomServiceServer(&fakeRooms{}))
	srv.Close()

	if _, err := NewAdmin(srv.URL, "key", "secret-de-teste-com-tamanho-suficiente").Identities(context.Background(), "call-1"); err == nil {
		t.Fatal("LiveKit fora do ar deveria ser erro")
	}
}
