package livekit

import (
	"context"
	"errors"

	lk "github.com/livekit/protocol/livekit"
	"github.com/twitchtv/twirp"
)

// participants lista quem está na sala pela API de administração do LiveKit.
// Sala que o LiveKit não conhece (ninguém conectou ainda, ou todos saíram) é
// ninguém.
func (a *Admin) participants(ctx context.Context, room string) ([]*lk.ParticipantInfo, error) {
	ctx, err := a.authed(ctx, room)
	if err != nil {
		return nil, err
	}
	res, err := a.client.ListParticipants(ctx, &lk.ListParticipantsRequest{Room: room})
	var twerr twirp.Error
	if errors.As(err, &twerr) && twerr.Code() == twirp.NotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return res.GetParticipants(), nil
}
