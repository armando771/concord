package websocket

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"time"
	"unicode/utf8"

	"gin-quickstart/backend/internal/user"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Atividade ("rich presence"): o que a pessoa está jogando agora. Fica só na
// memória do hub, como a presença: some quando a última conexão cai.

const (
	ActivityKindGame = "game"

	maxActivityNameRunes = 64
	// Um jogo novo a cada tantos segundos, no máximo, por usuário.
	activityMinInterval = time.Second
)

type Activity struct {
	Name string `json:"name"`
	Kind string `json:"kind"`
	// Unix em milissegundos de quando começou.
	StartedAt int64 `json:"started_at"`
}

// AudienceProvider diz quem pode ver a atividade de userID: amigos e quem
// divide servidor com ele (relações simétricas).
type AudienceProvider interface {
	Audience(ctx context.Context, userID string) ([]string, error)
}

func (h *Hub) SetAudience(a AudienceProvider) {
	h.mu.Lock()
	h.audience = a
	h.mu.Unlock()
}

// HandleActivity trata "activity:set" e "activity:clear" vindos do app.
func (h *Hub) HandleActivity(userID, evType string, payload json.RawMessage) {
	if evType == "activity:clear" {
		h.SetActivity(userID, nil)
		return
	}
	var p struct {
		Name      string `json:"name"`
		Kind      string `json:"kind"`
		StartedAt int64  `json:"started_at"`
	}
	if err := json.Unmarshal(payload, &p); err != nil {
		return
	}
	name := strings.TrimSpace(p.Name)
	if name == "" || utf8.RuneCountInString(name) > maxActivityNameRunes {
		return
	}
	if p.Kind != ActivityKindGame {
		return
	}
	now := time.Now().UnixMilli()
	started := p.StartedAt
	// Relógio do cliente não manda: início no futuro ou ausente vira agora.
	if started <= 0 || started > now {
		started = now
	}
	h.SetActivity(userID, &Activity{Name: name, Kind: p.Kind, StartedAt: started})
}

// SetActivity guarda (ou limpa, com nil) a atividade e avisa o público. Sem
// conexão aberta, não guarda nada.
func (h *Hub) SetActivity(userID string, a *Activity) {
	h.mu.Lock()
	if h.presence[userID] <= 0 {
		h.mu.Unlock()
		return
	}
	prev, had := h.activities[userID]
	if a == nil {
		if !had {
			h.mu.Unlock()
			return
		}
		delete(h.activities, userID)
		h.mu.Unlock()
		h.publishActivity(userID, nil)
		return
	}
	now := time.Now()
	if last, ok := h.activitySetAt[userID]; ok && now.Sub(last) < activityMinInterval {
		h.mu.Unlock()
		return
	}
	h.activitySetAt[userID] = now
	if had && prev.Name == a.Name && prev.Kind == a.Kind {
		h.mu.Unlock()
		return
	}
	h.activities[userID] = *a
	hidden := h.statuses[userID] == user.StatusInvisible
	h.mu.Unlock()

	if !hidden {
		h.publishActivity(userID, a)
	}
}

// publishActivity manda presence:activity para o público e para as conexões do
// próprio usuário. A consulta do público roda fora do lock.
func (h *Hub) publishActivity(userID string, a *Activity) {
	h.mu.RLock()
	provider := h.audience
	h.mu.RUnlock()

	event := writeEvent("presence:activity", map[string]interface{}{
		"user_id":  userID,
		"activity": a,
	})
	h.SendToUser(userID, event)
	if provider == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	ids, err := provider.Audience(ctx, userID)
	if err != nil {
		log.Printf("[ws] activity audience of %s: %v", userID, err)
		return
	}
	for _, id := range ids {
		h.SendToUser(id, event)
	}
}

// clearActivityLocked tira a atividade de quem saiu; devolve se havia uma.
// Precisa de h.mu (escrita).
func (h *Hub) clearActivityLocked(userID string) bool {
	_, had := h.activities[userID]
	delete(h.activities, userID)
	delete(h.activitySetAt, userID)
	return had
}

// ActivitiesFor devolve a atividade de cada id que viewerID pode ver (ele
// mesmo, amigos e quem divide servidor), sem quem está offline ou invisível.
func (h *Hub) ActivitiesFor(ctx context.Context, viewerID string, ids []string) map[string]Activity {
	h.mu.RLock()
	provider := h.audience
	h.mu.RUnlock()

	result := make(map[string]Activity)
	if provider == nil {
		return result
	}
	audience, err := provider.Audience(ctx, viewerID)
	if err != nil {
		log.Printf("[ws] activities audience of %s: %v", viewerID, err)
		return result
	}
	allowed := make(map[string]struct{}, len(audience)+1)
	allowed[viewerID] = struct{}{}
	for _, id := range audience {
		allowed[id] = struct{}{}
	}

	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, id := range ids {
		if _, ok := allowed[id]; !ok {
			continue
		}
		a, ok := h.activities[id]
		if !ok || h.effectiveStatusLocked(id) == user.StatusOffline {
			continue
		}
		result[id] = a
	}
	return result
}

// SQLAudience calcula o público direto no Postgres.
type SQLAudience struct {
	db *pgxpool.Pool
}

func NewSQLAudience(db *pgxpool.Pool) *SQLAudience {
	return &SQLAudience{db: db}
}

// Audience: amigos aceitos e membros de servidores em comum, sem quem bloqueou
// ou foi bloqueado.
func (a *SQLAudience) Audience(ctx context.Context, userID string) ([]string, error) {
	rows, err := a.db.Query(ctx, `
		SELECT id FROM (
			SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS id
			FROM friendships
			WHERE status = 'accepted' AND (requester_id = $1 OR addressee_id = $1)
			UNION
			SELECT m2.user_id AS id
			FROM server_members m1
			JOIN server_members m2 ON m2.server_id = m1.server_id
			WHERE m1.user_id = $1 AND m2.user_id <> $1
		) audience
		WHERE NOT EXISTS (
			SELECT 1 FROM user_blocks b
			WHERE (b.blocker_id = $1 AND b.blocked_id = audience.id)
			   OR (b.blocker_id = audience.id AND b.blocked_id = $1)
		)`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
