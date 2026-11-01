package livekit

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"

	lk "github.com/livekit/protocol/livekit"
	"github.com/twitchtv/twirp"
)

// fakeRooms responde só o ListParticipants da API do LiveKit.
type fakeRooms struct {
	lk.RoomService
	rooms map[string][]*lk.ParticipantInfo
	auth  string
}

func (f *fakeRooms) ListParticipants(ctx context.Context, req *lk.ListParticipantsRequest) (*lk.ListParticipantsResponse, error) {
	ps, ok := f.rooms[req.Room]
	if !ok {
		return nil, twirp.NotFoundError("room not found")
	}
	return &lk.ListParticipantsResponse{Participants: ps}, nil
}

func camera(muted bool) *lk.TrackInfo {
	return &lk.TrackInfo{Source: lk.TrackSource_CAMERA, Muted: muted}
}

func TestCamerasOnListsOnlyLiveCameras(t *testing.T) {
	rooms := &fakeRooms{rooms: map[string][]*lk.ParticipantInfo{
		"call-1": {
			{Identity: "ana", Tracks: []*lk.TrackInfo{{Source: lk.TrackSource_MICROPHONE}, camera(false)}},
			{Identity: "bia", Tracks: []*lk.TrackInfo{camera(true)}},                                    // pausada
			{Identity: "caio", Tracks: []*lk.TrackInfo{{Source: lk.TrackSource_SCREEN_SHARE}}},          // só tela
			{Identity: "duda", Tracks: []*lk.TrackInfo{camera(false), {Source: lk.TrackSource_CAMERA}}}, // duas faixas
		},
	}}
	api := lk.NewRoomServiceServer(rooms)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rooms.auth = r.Header.Get("Authorization")
		api.ServeHTTP(w, r)
	}))
	defer srv.Close()
	admin := NewAdmin(srv.URL, "key", "secret-de-teste-com-tamanho-suficiente")

	got, err := admin.CamerasOn(context.Background(), "call-1")
	if err != nil {
		t.Fatal(err)
	}
	sort.Strings(got)
	if strings.Join(got, ",") != "ana,duda" {
		t.Fatalf("cameras = %v, want ana and duda", got)
	}
	if !strings.HasPrefix(rooms.auth, "Bearer ") {
		t.Fatalf("authorization = %q, want the admin token", rooms.auth)
	}
}

// Sala que o LiveKit não conhece (ninguém conectou ainda) é ninguém de câmera.
func TestCamerasOnUnknownRoomIsEmpty(t *testing.T) {
	srv := httptest.NewServer(lk.NewRoomServiceServer(&fakeRooms{rooms: map[string][]*lk.ParticipantInfo{}}))
	defer srv.Close()
	got, err := NewAdmin(srv.URL, "key", "secret-de-teste-com-tamanho-suficiente").CamerasOn(context.Background(), "nada")
	if err != nil || len(got) != 0 {
		t.Fatalf("got %v, %v", got, err)
	}
}
