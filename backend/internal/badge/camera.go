package badge

import (
	"context"
	"log"
	"time"

	"gin-quickstart/backend/internal/call"
)

// CameraSource diz quem está com a câmera ligada numa chamada (a sala do
// LiveKit tem o id da chamada; platform/livekit.Admin implementa).
type CameraSource interface {
	CamerasOn(ctx context.Context, callID string) ([]string, error)
}

const (
	// Cada consulta ao LiveKit tem que caber no tick.
	cameraTimeout = 2 * time.Second
	// LiveKit fora do ar: um log a cada tanto, não a cada tick.
	cameraErrLogEvery = 10 * time.Minute
)

// WithCameras liga o badge Câmera ligada.
func (s *Service) WithCameras(c CameraSource) *Service {
	s.cameras = c
	return s
}

// camerasOn pergunta ao LiveKit quem está de câmera nas chamadas em que ela
// pode contar (duas pessoas ouvindo). Erro: a câmera não conta neste tick.
func (s *Service) camerasOn(ctx context.Context, snaps []call.CallSnapshot) map[string]bool {
	if s.cameras == nil {
		return nil
	}
	on := map[string]bool{}
	for _, snap := range snaps {
		if len(snap.Listeners) < 2 {
			continue
		}
		cctx, cancel := context.WithTimeout(ctx, cameraTimeout)
		ids, err := s.cameras.CamerasOn(cctx, snap.CallID)
		cancel()
		if err != nil {
			s.logCameraError(err)
			continue
		}
		for _, id := range ids {
			on[id] = true
		}
	}
	return on
}

func (s *Service) logCameraError(err error) {
	if time.Since(s.cameraErrAt) < cameraErrLogEvery {
		return
	}
	s.cameraErrAt = time.Now()
	log.Printf("[badge] câmeras no LiveKit: %v", err)
}
