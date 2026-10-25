package badge

import (
	"context"
	"encoding/json"
	"log"
	"sort"
	"sync"
	"time"

	"gin-quickstart/backend/internal/call"
)

const (
	// O que o tracker juntou vai para o banco a cada minuto.
	flushEvery = 6 // ticks
	// Quem está online e fora de call (mensagens, reações, servidor novo,
	// aniversário de conta) é conferido a cada 5 minutos.
	onlineSweepEvery = 30 // ticks
)

type store interface {
	Stats(ctx context.Context, userID string) (Stats, error)
	Unlocks(ctx context.Context, userID string) (Unlocks, error)
	SaveUnlocks(ctx context.Context, userID string, unlocks []Unlock) ([]Unlock, error)
	AddCallStats(ctx context.Context, userID string, d Delta) error
}

// EventPublisher avisa a própria pessoa (o hub do websocket implementa).
type EventPublisher interface {
	SendToUser(userID string, event []byte)
}

// CallSource diz quem está em cada chamada agora (call.Service).
type CallSource interface {
	CallSnapshots() []call.CallSnapshot
}

// OnlineSource lista quem está conectado (o hub do websocket).
type OnlineSource interface {
	OnlineUserIDs() []string
}

// Response é o GET /users/:id/badges.
type Response struct {
	UserID string  `json:"user_id"`
	Badges []Badge `json:"badges"`
}

// UnlockEvent vai só para a própria pessoa quando ela alcança tiers novos.
type UnlockEvent struct {
	UserID  string          `json:"user_id"`
	Unlocks []UnlockPayload `json:"unlocks"`
}

type UnlockPayload struct {
	Category string `json:"category"`
	Name     string `json:"name"`
	Tier     int    `json:"tier"`
	TierName string `json:"tier_name"`
	Rarity   string `json:"rarity"`
}

type Service struct {
	store     store
	publisher EventPublisher
	calls     CallSource
	online    OnlineSource
	now       func() time.Time

	mu      sync.Mutex
	tracker *tracker
	ticks   int
}

// BadgeService monta o serviço. loc é o fuso das horas de Coruja/Madrugador
// (o horário do servidor: time.Local, que segue a variável TZ).
func BadgeService(repository *Repository, publisher EventPublisher, calls CallSource, online OnlineSource, loc *time.Location) *Service {
	return &Service{
		store:     repository,
		publisher: publisher,
		calls:     calls,
		online:    online,
		now:       time.Now,
		tracker:   newTracker(time.Now(), loc),
	}
}

// Badges calcula os badges de alguém e grava os tiers alcançados agora.
func (s *Service) Badges(ctx context.Context, userID string) (Response, error) {
	badges, err := s.sync(ctx, userID)
	if err != nil {
		return Response{}, err
	}
	return Response{UserID: userID, Badges: badges}, nil
}

func (s *Service) sync(ctx context.Context, userID string) ([]Badge, error) {
	stats, err := s.store.Stats(ctx, userID)
	if err != nil {
		return nil, err
	}
	stored, err := s.store.Unlocks(ctx, userID)
	if err != nil {
		return nil, err
	}
	badges, fresh := Evaluate(stats, stored, s.now())
	if len(fresh) == 0 {
		return badges, nil
	}
	saved, err := s.store.SaveUnlocks(ctx, userID, fresh)
	if err != nil {
		// A resposta já está certa; grava na próxima vez.
		log.Printf("[badge] save unlocks for %s: %v", userID, err)
		return badges, nil
	}
	s.announce(userID, saved)
	return badges, nil
}

func (s *Service) announce(userID string, saved []Unlock) {
	if len(saved) == 0 || s.publisher == nil {
		return
	}
	byKey := make(map[string]Category, len(Catalog))
	for _, c := range Catalog {
		byKey[c.Key] = c
	}
	ev := UnlockEvent{UserID: userID}
	for _, u := range saved {
		c, ok := byKey[u.Category]
		if !ok || u.Tier < 1 || u.Tier > len(c.Tiers) {
			continue
		}
		t := c.Tiers[u.Tier-1]
		ev.Unlocks = append(ev.Unlocks, UnlockPayload{
			Category: c.Key, Name: c.Name, Tier: u.Tier, TierName: t.Name, Rarity: t.Rarity,
		})
	}
	if len(ev.Unlocks) == 0 {
		return
	}
	// Do tier mais alto para o mais baixo: o app mostra o primeiro.
	sort.SliceStable(ev.Unlocks, func(i, j int) bool {
		return rarityRank(ev.Unlocks[i].Rarity) > rarityRank(ev.Unlocks[j].Rarity)
	})
	s.publisher.SendToUser(userID, marshalEvent("badge:unlock", ev))
}

func rarityRank(r string) int {
	switch r {
	case RarityLegendary:
		return 3
	case RarityEpic:
		return 2
	case RarityRare:
		return 1
	}
	return 0
}

// Run acompanha as chamadas até ctx acabar.
func (s *Service) Run(ctx context.Context) {
	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()
	s.mu.Lock()
	s.tracker.lastTick = time.Now()
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
	s.mu.Lock()
	s.tracker.accrue(s.calls.CallSnapshots(), now)
	s.ticks++
	flush := s.ticks%flushEvery == 0
	sweep := s.ticks%onlineSweepEvery == 0
	var deltas map[string]Delta
	if flush {
		deltas = s.tracker.drain()
	}
	s.mu.Unlock()

	if !flush {
		return
	}
	touched := make(map[string]bool, len(deltas))
	for userID, d := range deltas {
		if err := s.store.AddCallStats(ctx, userID, d); err != nil {
			log.Printf("[badge] add call stats for %s: %v", userID, err)
			continue
		}
		touched[userID] = true
	}
	// Quem está em call com XP também sobe Tempo em call e Nível.
	for _, snap := range s.calls.CallSnapshots() {
		for _, userID := range snap.Voice {
			touched[userID] = true
		}
	}
	if sweep && s.online != nil {
		for _, userID := range s.online.OnlineUserIDs() {
			touched[userID] = true
		}
	}
	ids := make([]string, 0, len(touched))
	for userID := range touched {
		ids = append(ids, userID)
	}
	sort.Strings(ids)
	for _, userID := range ids {
		if _, err := s.sync(ctx, userID); err != nil {
			log.Printf("[badge] sync %s: %v", userID, err)
		}
	}
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
