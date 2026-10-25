package level

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"gin-quickstart/backend/internal/call"
)

// De quanto em quanto tempo o serviço olha quem está em call. O XP só é dado
// por minuto completo de voz captada: o tempo calado não conta (mas também
// não zera), e mutar, ensurdecer ou sair antes de fechar o minuto perde os
// segundos acumulados.
const tickInterval = 10 * time.Second

type EventPublisher interface {
	SendToUser(userID string, event []byte)
	BroadcastToCall(callID string, event []byte)
	BroadcastToRoom(room string, event []byte)
}

// VoiceSource diz quem está participando das chamadas agora (call.Service).
type VoiceSource interface {
	ActiveVoiceUsers() []call.VoiceActivity
}

type xpStore interface {
	AddVoiceXP(ctx context.Context, userID string, xp int64, seconds int64) (int64, int64, error)
}

// grant é XP pronto para ser gravado.
type grant struct {
	activity call.VoiceActivity
	minutes  int64
}

type Service struct {
	repository *Repository
	store      xpStore
	publisher  EventPublisher
	voice      VoiceSource

	mu sync.Mutex
	// pending: tempo elegível de cada usuário que ainda não fechou um minuto.
	pending  map[string]time.Duration
	lastTick time.Time
}

func LevelService(repository *Repository, publisher EventPublisher, voice VoiceSource) *Service {
	return &Service{
		repository: repository,
		store:      repository,
		publisher:  publisher,
		voice:      voice,
		pending:    make(map[string]time.Duration),
	}
}

// Run conta o tempo de voz até ctx acabar.
func (s *Service) Run(ctx context.Context) {
	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()

	s.mu.Lock()
	s.lastTick = time.Now()
	s.mu.Unlock()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			s.tick(ctx, now)
		}
	}
}

func (s *Service) tick(ctx context.Context, now time.Time) {
	for _, g := range s.accrue(s.voice.ActiveVoiceUsers(), now) {
		s.give(ctx, g)
	}
}

// accrue soma o tempo desde o último tick para quem está falando agora e
// devolve os minutos completos. Quem está na call desmutado mas calado não
// soma nada e mantém o que tinha; quem não está mais elegível (mutou, saiu…)
// perde o que tinha acumulado.
func (s *Service) accrue(active []call.VoiceActivity, now time.Time) []grant {
	s.mu.Lock()
	defer s.mu.Unlock()

	elapsed := now.Sub(s.lastTick)
	s.lastTick = now
	// Servidor travado/suspenso: não dá de uma vez o tempo que ninguém viu.
	if elapsed > 2*tickInterval || elapsed < 0 {
		elapsed = tickInterval
	}

	stillActive := make(map[string]bool, len(active))
	var grants []grant
	for _, a := range active {
		if stillActive[a.UserID] {
			continue
		}
		stillActive[a.UserID] = true
		if !a.Speaking {
			continue
		}

		total := s.pending[a.UserID] + elapsed
		minutes := int64(total / time.Minute)
		s.pending[a.UserID] = total - time.Duration(minutes)*time.Minute
		if minutes > 0 {
			grants = append(grants, grant{activity: a, minutes: minutes})
		}
	}
	for userID := range s.pending {
		if !stillActive[userID] {
			delete(s.pending, userID)
		}
	}
	return grants
}

func (s *Service) give(ctx context.Context, g grant) {
	userID := g.activity.UserID
	xp := g.minutes * XPPerMinute
	totalXP, totalSeconds, err := s.store.AddVoiceXP(ctx, userID, xp, g.minutes*60)
	if err != nil {
		log.Printf("[level] add xp for %s: %v", userID, err)
		return
	}

	progress := newProgress(userID, totalXP, totalSeconds)
	s.publisher.SendToUser(userID, marshalEvent("level:update", progress))

	previous, _, _ := FromXP(totalXP - xp)
	if progress.Level == previous {
		return
	}
	event := marshalEvent("level:up", LevelUpEvent{
		UserID:        userID,
		Level:         progress.Level,
		PreviousLevel: previous,
		CallID:        g.activity.CallID,
		ServerID:      g.activity.ServerID,
	})
	s.publisher.BroadcastToCall(g.activity.CallID, event)
	if g.activity.ServerID != nil {
		s.publisher.BroadcastToRoom("server:"+*g.activity.ServerID, event)
	}
	s.publisher.SendToUser(userID, event)
}

func (s *Service) FindByUserIDs(ctx context.Context, userIDs []string) (map[string]Progress, error) {
	return s.repository.FindByUserIDs(ctx, userIDs)
}

func marshalEvent(typ string, payload interface{}) []byte {
	data, err := json.Marshal(map[string]interface{}{
		"type":    typ,
		"payload": payload,
	})
	if err != nil {
		return nil
	}
	return data
}
