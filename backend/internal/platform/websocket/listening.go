package websocket

import (
	"encoding/json"
	"strings"
	"time"
)

// Música ("Ouvindo"): a faixa que a pessoa está ouvindo agora (Spotify,
// YouTube Music...). Vai pelo mesmo caminho do jogo (activity:set com
// kind "listening") e mora num slot próprio: dá para jogar e ouvir ao mesmo tempo.

const (
	ActivityKindListening = "listening"

	maxListeningAppRunes = 64
	maxTrackTextRunes    = 128
	maxTrackDurationMs   = int64(24 * time.Hour / time.Millisecond)
	// Mesma faixa com o início até tanto fora do anterior não avisa ninguém.
	listeningStartTolerance = 2 * time.Second
)

type Listening struct {
	App    string `json:"app"`
	Title  string `json:"title"`
	Artist string `json:"artist,omitempty"`
	Album  string `json:"album,omitempty"`
	// Unix em ms (relógio do servidor) de quando a faixa começou: agora - posição.
	// Quem vê calcula o tempo decorrido sozinho.
	StartedAt int64 `json:"started_at"`
	// 0 = duração desconhecida (transmissão ao vivo, player que não informa).
	DurationMs int64 `json:"duration_ms,omitempty"`
}

// parseListening valida a música que o app mandou; ok = false descarta.
func parseListening(payload json.RawMessage, now time.Time) (*Listening, bool) {
	var p struct {
		App        string `json:"app"`
		Title      string `json:"title"`
		Artist     string `json:"artist"`
		Album      string `json:"album"`
		PositionMs int64  `json:"position_ms"`
		DurationMs int64  `json:"duration_ms"`
	}
	if err := json.Unmarshal(payload, &p); err != nil {
		return nil, false
	}
	l := Listening{
		App:    strings.TrimSpace(p.App),
		Title:  strings.TrimSpace(p.Title),
		Artist: strings.TrimSpace(p.Artist),
		Album:  strings.TrimSpace(p.Album),
	}
	if !validTrackText(l) {
		return nil, false
	}
	l.DurationMs = clampDuration(p.DurationMs)
	l.StartedAt = now.UnixMilli() - clampPosition(p.PositionMs, l.DurationMs)
	return &l, true
}

func validTrackText(l Listening) bool {
	return runesWithin(l.App, 1, maxListeningAppRunes) &&
		runesWithin(l.Title, 1, maxTrackTextRunes) &&
		runesWithin(l.Artist, 0, maxTrackTextRunes) &&
		runesWithin(l.Album, 0, maxTrackTextRunes)
}

// clampDuration: fora de (0, 24 h] vira desconhecida.
func clampDuration(ms int64) int64 {
	if ms <= 0 || ms > maxTrackDurationMs {
		return 0
	}
	return ms
}

// clampPosition: entre 0 e o fim da faixa (ou 24 h, sem duração).
func clampPosition(pos, duration int64) int64 {
	limit := duration
	if limit == 0 {
		limit = maxTrackDurationMs
	}
	return min(max(pos, 0), limit)
}

// sameListening: a mesma faixa, no mesmo ponto (com folga), não avisa ninguém.
func sameListening(prev, next Listening) bool {
	drift := time.Duration(prev.StartedAt-next.StartedAt) * time.Millisecond
	if drift < 0 {
		drift = -drift
	}
	prev.StartedAt, next.StartedAt = 0, 0
	return prev == next && drift < listeningStartTolerance
}

// SetListening guarda (ou limpa, com nil) a música e avisa o público.
func (h *Hub) SetListening(userID string, l *Listening) {
	h.changeActivity(userID, func(r *richPresence, now time.Time) bool {
		if l == nil {
			return r.listening.clear(userID)
		}
		return r.listening.set(userID, *l, now)
	})
}
