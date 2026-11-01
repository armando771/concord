package livekit

import (
	"context"
	"net/http"
	"time"

	"github.com/livekit/protocol/auth"
	lk "github.com/livekit/protocol/livekit"
	"github.com/twitchtv/twirp"
)

// Admin muda as permissões de quem já está numa sala e desconecta
// participantes (API de administração do LiveKit, pelo mesmo endereço local
// do proxy /rtc).
type Admin struct {
	apiKey    string
	apiSecret string
	client    lk.RoomService
}

func NewAdmin(baseURL, apiKey, apiSecret string) *Admin {
	return &Admin{
		apiKey:    apiKey,
		apiSecret: apiSecret,
		client:    lk.NewRoomServiceProtobufClient(baseURL, &http.Client{Timeout: 10 * time.Second}),
	}
}

// authed devolve o contexto com o token de administrador da sala.
func (a *Admin) authed(ctx context.Context, room string) (context.Context, error) {
	token, err := auth.NewAccessToken(a.apiKey, a.apiSecret).
		SetValidFor(time.Minute).
		SetVideoGrant(&auth.VideoGrant{RoomAdmin: true, Room: room}).
		ToJWT()
	if err != nil {
		return ctx, err
	}
	header := http.Header{}
	header.Set("Authorization", "Bearer "+token)
	return twirp.WithHTTPRequestHeaders(ctx, header)
}

// UpdatePermissions troca o que o participante pode publicar e ouvir; o
// LiveKit corta na hora as faixas que deixaram de valer.
func (a *Admin) UpdatePermissions(ctx context.Context, room, identity string, g Grant) error {
	ctx, err := a.authed(ctx, room)
	if err != nil {
		return err
	}
	_, err = a.client.UpdateParticipant(ctx, &lk.UpdateParticipantRequest{
		Room:       room,
		Identity:   identity,
		Permission: g.Permission(),
	})
	return err
}

// Remove desconecta o participante da sala.
func (a *Admin) Remove(ctx context.Context, room, identity string) error {
	ctx, err := a.authed(ctx, room)
	if err != nil {
		return err
	}
	_, err = a.client.RemoveParticipant(ctx, &lk.RoomParticipantIdentity{Room: room, Identity: identity})
	return err
}
