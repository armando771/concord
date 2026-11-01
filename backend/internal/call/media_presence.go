package call

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"
)

// Presença na mídia (#374): a lista da chamada segue a sala do LiveKit, não só
// o WebSocket. Quem reconecta o WS dentro da tolerância mas não volta à call
// (app reaberto sem retomar, cliente travado) sai dela. Dois caminhos:
//
//   - o app avisa ("call:presence" {call_id: null}) que não está em call
//     nenhuma depois de decidir que não vai retomar; fora da sala de mídia,
//     sai na hora;
//   - a cada MediaSweepEvery a varredura confere a sala de cada chamada e tira
//     quem faltou em duas conferências seguidas (clientes antigos e travados).
//
// O LiveKit é quem decide: quem está na sala nunca sai por aqui (outro
// aparelho da mesma pessoa, queda curta que a mídia aguenta sozinha).
// Ver docs/adr/0018-presenca-na-midia.md.

const (
	// MediaSweepEvery: intervalo da varredura das salas de mídia.
	MediaSweepEvery = 20 * time.Second
	// MediaJoinGrace: quem acabou de entrar tem esse tempo para conectar à
	// mídia (microfone, token, LiveKit) antes de contar como ausente.
	MediaJoinGrace = 30 * time.Second
	// mediaMissesToLeave: ausências seguintes que tiram alguém da chamada.
	mediaMissesToLeave = 2
	// Cada consulta ao LiveKit; a do aviso do app segura a fila do WS dele.
	mediaRosterTimeout = 3 * time.Second
	// LiveKit fora do ar: um log a cada tanto, não a cada varredura.
	mediaErrLogEvery = 10 * time.Minute
)

// MediaRoster diz quem está na sala de mídia de uma chamada (a sala do
// LiveKit tem o id da chamada; platform/livekit.Admin implementa).
type MediaRoster interface {
	Identities(ctx context.Context, room string) ([]string, error)
}

// mediaWatch acompanha um participante (numa entrada na chamada).
type mediaWatch struct {
	since  time.Time // primeira varredura que o viu na chamada
	misses int       // ausências seguidas da sala de mídia
}

type mediaKey struct {
	callID, userID string
	joinedAt       time.Time
}

// MediaPresence tira da chamada quem não está na sala de mídia.
type MediaPresence struct {
	calls  *Service
	roster MediaRoster
	now    func() time.Time

	mu      sync.Mutex
	watches map[mediaKey]*mediaWatch
	// declared: quem avisou pelo app que não está em call nenhuma.
	declared map[string]bool
	errAt    time.Time
}

func NewMediaPresence(calls *Service, roster MediaRoster, now func() time.Time) *MediaPresence {
	return &MediaPresence{
		calls:    calls,
		roster:   roster,
		now:      now,
		watches:  make(map[mediaKey]*mediaWatch),
		declared: make(map[string]bool),
	}
}

// Run varre as salas a cada `every` até o contexto acabar.
func (m *MediaPresence) Run(ctx context.Context, every time.Duration) {
	ticker := time.NewTicker(every)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.Sweep(ctx)
		}
	}
}

// Sweep confere a sala de mídia de cada chamada ativa.
func (m *MediaPresence) Sweep(ctx context.Context) {
	snaps := m.calls.CallSnapshots()
	seen := make(map[mediaKey]bool)
	inCall := make(map[string]bool)
	for _, snap := range snaps {
		for _, userID := range snap.Participants {
			key := mediaKey{snap.CallID, userID, snap.JoinedAt[userID]}
			seen[key] = true
			inCall[userID] = true
		}
		present, ok := m.identities(ctx, snap.CallID)
		if !ok {
			continue
		}
		for _, userID := range snap.Participants {
			key := mediaKey{snap.CallID, userID, snap.JoinedAt[userID]}
			if m.miss(key, present[userID]) {
				m.leave(ctx, snap.CallID, userID)
			}
		}
	}
	m.forget(seen, inCall)
}

// miss registra a conferência de um participante e diz se ele sai agora.
func (m *MediaPresence) miss(key mediaKey, present bool) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.now()
	w := m.watches[key]
	if w == nil {
		w = &mediaWatch{since: now}
		m.watches[key] = w
	}
	if present {
		w.misses = 0
		return false
	}
	if now.Sub(w.since) < MediaJoinGrace {
		return false
	}
	w.misses++
	return w.misses >= mediaMissesToLeave || m.declared[key.userID]
}

// forget descarta quem não está mais nas chamadas.
func (m *MediaPresence) forget(seen map[mediaKey]bool, inCall map[string]bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for key := range m.watches {
		if !seen[key] {
			delete(m.watches, key)
		}
	}
	for userID := range m.declared {
		if !inCall[userID] {
			delete(m.declared, userID)
		}
	}
}

// identities: o conjunto de quem está na sala; ok=false se o LiveKit não
// respondeu (aí ninguém sai).
func (m *MediaPresence) identities(ctx context.Context, callID string) (map[string]bool, bool) {
	ctx, cancel := context.WithTimeout(ctx, mediaRosterTimeout)
	defer cancel()
	ids, err := m.roster.Identities(ctx, callID)
	if err != nil {
		m.logError(err)
		return nil, false
	}
	set := make(map[string]bool, len(ids))
	for _, id := range ids {
		set[id] = true
	}
	return set, true
}

func (m *MediaPresence) logError(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.errAt.IsZero() && m.now().Sub(m.errAt) < mediaErrLogEvery {
		return
	}
	m.errAt = m.now()
	log.Printf("[call] salas de mídia no LiveKit: %v", err)
}

func (m *MediaPresence) leave(ctx context.Context, callID, userID string) {
	m.mu.Lock()
	delete(m.declared, userID)
	m.mu.Unlock()
	log.Printf("[call] %s não está na mídia da chamada %s: sai da chamada", userID, callID)
	m.calls.leaveMissingFromMedia(ctx, callID, userID)
}

type presencePayload struct {
	CallID *string `json:"call_id"`
}

// HandlePresence trata o "call:presence" do app: {call_id} diz em que call ele
// está; {call_id: null}, que não está em nenhuma (e não vai retomar). Roda na
// fila do WS de quem mandou, então uma entrada logo depois não é desfeita.
func (m *MediaPresence) HandlePresence(userID string, payload json.RawMessage) {
	var p presencePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return
	}
	m.mu.Lock()
	if p.CallID != nil && *p.CallID != "" {
		delete(m.declared, userID)
		m.mu.Unlock()
		return
	}
	m.declared[userID] = true
	m.mu.Unlock()
	m.leaveIfMissing(context.Background(), userID)
}

// leaveIfMissing tira o usuário das chamadas em que ele não está na mídia.
// Quem acabou de entrar (outro aparelho conectando) fica.
func (m *MediaPresence) leaveIfMissing(ctx context.Context, userID string) {
	for _, snap := range m.calls.CallSnapshots() {
		joinedAt, in := snap.JoinedAt[userID]
		if !in || m.now().Sub(joinedAt) < MediaJoinGrace {
			continue
		}
		present, ok := m.identities(ctx, snap.CallID)
		if ok && !present[userID] {
			m.leave(ctx, snap.CallID, userID)
		}
	}
}

// Router embrulha o roteador de chamadas do WebSocket: "call:presence" vem
// para cá, o resto segue.
func (m *MediaPresence) Router(next callMessageRouter) PresenceRouter {
	return PresenceRouter{callMessageRouter: next, presence: m}
}

// PresenceRouter manda "call:presence" para a MediaPresence e o resto adiante.
type PresenceRouter struct {
	callMessageRouter
	presence *MediaPresence
}

func (r PresenceRouter) HandleCallMessage(userID string, evType string, payload json.RawMessage) {
	if evType == "call:presence" {
		r.presence.HandlePresence(userID, payload)
		return
	}
	r.callMessageRouter.HandleCallMessage(userID, evType, payload)
}

// leaveMissingFromMedia tira da chamada quem não está na sala de mídia, como
// numa queda do WS: os eventos normais de saída e, se a sala estiver
// trancada, volta sem bater na porta.
func (s *Service) leaveMissingFromMedia(ctx context.Context, callID, userID string) {
	s.mu.Lock()
	if ac, ok := s.calls[callID]; ok {
		if _, in := ac.participants[userID]; in {
			admitLocked(ac, userID, time.Now().Add(rejoinTTL))
		}
	}
	s.mu.Unlock()
	if err := s.leaveAfterDisconnect(ctx, callID, userID); err != nil {
		log.Printf("[call] saída fora da mídia %s: %v", userID, err)
	}
}
