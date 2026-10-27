package livekit

import (
	"context"
	"errors"

	lk "github.com/livekit/protocol/livekit"
	"github.com/twitchtv/twirp"
)

// CamerasOn lista quem está com a câmera ligada na sala (faixa de câmera
// publicada e não pausada), pela API de administração do LiveKit. Só lê
// metadados da sala: a mídia continua indo direto para o LiveKit. Sala que
// o LiveKit não conhece é ninguém.
func (a *Admin) CamerasOn(ctx context.Context, room string) ([]string, error) {
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
	var out []string
	for _, p := range res.GetParticipants() {
		if hasLiveCamera(p) {
			out = append(out, p.GetIdentity())
		}
	}
	return out, nil
}

func hasLiveCamera(p *lk.ParticipantInfo) bool {
	for _, t := range p.GetTracks() {
		if t.GetSource() == lk.TrackSource_CAMERA && !t.GetMuted() {
			return true
		}
	}
	return false
}
