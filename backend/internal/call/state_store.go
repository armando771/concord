package call

// Gravação do estado de quem está na chamada (mudo, tela, moderação) para o
// reinício do backend. Extraído do service.go.

import (
	"context"
	"log"
	"time"
)

// participantStateStore guarda o estado de voz/tela de quem está na chamada,
// que RestoreActive lê de volta quando o backend reinicia.
type participantStateStore interface {
	SaveVoiceState(ctx context.Context, callID string, userID string, muted bool, deafened bool) error
	SaveScreenSharing(ctx context.Context, callID string, userID string, active bool) error
	// Silenciar/ensurdecer de moderador: sem isso um deploy liberaria quem foi
	// silenciado.
	SaveServerVoiceState(ctx context.Context, callID string, userID string, serverMuted bool, serverDeafened bool) error
	// A DM atendida passa a ativa no banco: senão continua "ringing" e o
	// próximo reinício a encerra.
	MarkCallActive(ctx context.Context, callID string) error
}

// Gravar o estado não pode travar o WebSocket de quem mutou.
const saveStateTimeout = 2 * time.Second

func (s *Service) saveVoiceState(callID, userID string, muted, deafened bool) {
	if s.stateStore == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), saveStateTimeout)
	defer cancel()
	if err := s.stateStore.SaveVoiceState(ctx, callID, userID, muted, deafened); err != nil {
		log.Printf("[call] persist voice state %s failed: %v", userID, err)
	}
}

func (s *Service) saveServerVoiceState(callID, userID string, serverMuted, serverDeafened bool) {
	if s.stateStore == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), saveStateTimeout)
	defer cancel()
	if err := s.stateStore.SaveServerVoiceState(ctx, callID, userID, serverMuted, serverDeafened); err != nil {
		log.Printf("[call] persist server voice state %s failed: %v", userID, err)
	}
}

func (s *Service) markCallActive(callID string) {
	if s.stateStore == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), saveStateTimeout)
	defer cancel()
	if err := s.stateStore.MarkCallActive(ctx, callID); err != nil {
		log.Printf("[call] persist active %s failed: %v", callID, err)
	}
}

func (s *Service) saveScreenSharing(callID, userID string, active bool) {
	if s.stateStore == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), saveStateTimeout)
	defer cancel()
	if err := s.stateStore.SaveScreenSharing(ctx, callID, userID, active); err != nil {
		log.Printf("[call] persist screen share %s failed: %v", userID, err)
	}
}
