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
	// Sessão de maratona gravada no desligamento vale para o processo novo
	// se ele subir dentro desse prazo (deploy sem queda).
	sessionResumeWindow = 5 * time.Minute
	// Tempo para gravar tudo ao desligar.
	shutdownFlushTimeout = 3 * time.Second
)

type store interface {
	Stats(ctx context.Context, userID string) (Stats, error)
	Unlocks(ctx context.Context, userID string) (Unlocks, error)
	SaveUnlocks(ctx context.Context, userID string, unlocks []Unlock) ([]Unlock, error)
	AddCallStats(ctx context.Context, userID string, d Delta) error
	SaveSessions(ctx context.Context, sessions map[string]int64) error
	LoadSessions(ctx context.Context, maxAge time.Duration) (map[string]int64, error)
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

// Response é o GET /users/:id/badges. A própria pessoa recebe []Badge
// (números, progresso, próximos tiers); os outros, []PublicBadge (só o que
// ela conquistou e o dia).
type Response struct {
	UserID string `json:"user_id"`
	Self   bool   `json:"self"`
	Badges any    `json:"badges"`
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

// BadgeService monta o serviço. loc é o fuso das horas de Coruja/Madrugador;
// nil usa Brasília (America/Sao_Paulo), independente do relógio da máquina.
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

// Badges calcula os badges de userID vistos por viewerID e grava os tiers
// alcançados agora. Quem não é a pessoa vê só os tiers conquistados e o dia.
func (s *Service) Badges(ctx context.Context, viewerID, userID string) (Response, error) {
	badges, err := s.sync(ctx, userID)
	if err != nil {
		return Response{}, err
	}
	if viewerID == userID {
		return Response{UserID: userID, Self: true, Badges: badges}, nil
	}
	return Response{UserID: userID, Badges: publicView(badges)}, nil
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

// announce avisa um badge por categoria (o tier mais alto que entrou agora):
// no primeiro deploy, voz 1–4 de uma vez é um badge novo, não quatro.
func (s *Service) announce(userID string, saved []Unlock) {
	if len(saved) == 0 || s.publisher == nil {
		return
	}
	byKey := make(map[string]Category, len(Catalog))
	for _, c := range Catalog {
		byKey[c.Key] = c
	}
	highest := make(map[string]int)
	var order []string
	for _, u := range saved {
		c, ok := byKey[u.Category]
		if !ok || u.Tier < 1 || u.Tier > len(c.Tiers) {
			continue
		}
		if _, seen := highest[u.Category]; !seen {
			order = append(order, u.Category)
		}
		if u.Tier > highest[u.Category] {
			highest[u.Category] = u.Tier
		}
	}
	ev := UnlockEvent{UserID: userID}
	for _, key := range order {
		c, tier := byKey[key], highest[key]
		t := c.Tiers[tier-1]
		ev.Unlocks = append(ev.Unlocks, UnlockPayload{
			Category: c.Key, Name: c.Name, Tier: tier, TierName: t.Name, Rarity: t.Rarity,
		})
	}
	if len(ev.Unlocks) == 0 {
		return
	}
	// Do mais raro para o mais comum: o app mostra o primeiro.
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

// Run acompanha as chamadas até ctx acabar. Ao acabar (SIGTERM do deploy),
// grava o que ainda estava na memória e as sessões de maratona em andamento,
// e só então retorna: quem chama espera antes de fechar o banco.
func (s *Service) Run(ctx context.Context) {
	s.resume(ctx)
	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()
	s.mu.Lock()
	s.tracker.lastTick = time.Now()
	s.mu.Unlock()
	for {
		select {
		case <-ctx.Done():
			s.shutdown()
			return
		case now := <-ticker.C:
			s.tick(ctx, now)
		}
	}
}

// resume carrega as sessões que o processo anterior gravou ao desligar.
func (s *Service) resume(ctx context.Context) {
	saved, err := s.store.LoadSessions(ctx, sessionResumeWindow)
	if err != nil {
		log.Printf("[badge] load sessions: %v", err)
		return
	}
	sessions := make(map[string]time.Duration, len(saved))
	for userID, secs := range saved {
		sessions[userID] = time.Duration(secs) * time.Second
	}
	s.mu.Lock()
	s.tracker.resumeSessions(sessions)
	s.mu.Unlock()
}

// shutdown grava tudo com um contexto novo (o do Run já foi cancelado).
func (s *Service) shutdown() {
	ctx, cancel := context.WithTimeout(context.Background(), shutdownFlushTimeout)
	defer cancel()
	s.mu.Lock()
	deltas := s.tracker.drain()
	active := s.tracker.activeSessions()
	s.mu.Unlock()
	s.flush(ctx, deltas)
	sessions := make(map[string]int64, len(active))
	for userID, d := range active {
		sessions[userID] = int64(d / time.Second)
	}
	if err := s.store.SaveSessions(ctx, sessions); err != nil {
		log.Printf("[badge] save sessions: %v", err)
	}
}

// flush grava os deltas; o que falhar volta para o tracker e vai no próximo.
func (s *Service) flush(ctx context.Context, deltas map[string]Delta) map[string]bool {
	written := make(map[string]bool, len(deltas))
	for userID, d := range deltas {
		if err := s.store.AddCallStats(ctx, userID, d); err != nil {
			log.Printf("[badge] add call stats for %s: %v", userID, err)
			s.mu.Lock()
			s.tracker.restore(userID, d)
			s.mu.Unlock()
			continue
		}
		written[userID] = true
	}
	return written
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
	touched := s.flush(ctx, deltas)
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
