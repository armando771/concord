package livekit

import (
	"context"

	lk "github.com/livekit/protocol/livekit"
)

// CamerasOn lista quem está com a câmera ligada na sala (faixa de câmera
// publicada e não pausada), pela API de administração do LiveKit. Só lê
// metadados da sala: a mídia continua indo direto para o LiveKit. Sala que
// o LiveKit não conhece é ninguém.
func (a *Admin) CamerasOn(ctx context.Context, room string) ([]string, error) {
	participants, err := a.participants(ctx, room)
	if err != nil {
		return nil, err
	}
	var out []string
	for _, p := range participants {
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
