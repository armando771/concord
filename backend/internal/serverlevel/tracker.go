package serverlevel

import (
	"time"

	"gin-quickstart/backend/internal/call"
)

// De quanto em quanto tempo o serviço olha as chamadas (o mesmo do XP e dos
// badges).
const tickInterval = 10 * time.Second

type key struct {
	serverID, userID, source string
}

// grant é XP pronto para gravar.
type grant struct {
	serverID, userID, source string
	xp                       int64
}

// tracker soma, em memória, o tempo de cada pessoa em cada fonte de tempo
// por servidor. Não sabe de banco: o serviço drena e grava. As fotos vêm do
// call.AFK (quem está há 10 min sem falar já chega fora de Voice,
// ScreenSharers e ScreenWatchers, e em Away) e as regras são as do XP de voz
// e dos badges Streamer, Espectador e Festeiro.
type tracker struct {
	lastTick time.Time
	pending  map[key]time.Duration
	// touched: quem somou desde o último drain (o resto de quem saiu some).
	touched map[key]bool
}

func newTracker(start time.Time) *tracker {
	return &tracker{lastTick: start, pending: make(map[key]time.Duration), touched: make(map[key]bool)}
}

// accrue soma o tempo desde o último tick. real: contas reais (as outras não
// contam).
func (t *tracker) accrue(snaps []call.CallSnapshot, real map[string]bool, now time.Time) {
	elapsed := now.Sub(t.lastTick)
	t.lastTick = now
	// Servidor travado/suspenso: não dá de uma vez o tempo que ninguém viu.
	if elapsed > 2*tickInterval || elapsed < 0 {
		elapsed = tickInterval
	}
	for _, s := range snaps {
		if s.ServerID == nil {
			continue
		}
		add := func(source string, userIDs []string) {
			for _, userID := range userIDs {
				if real[userID] {
					k := key{*s.ServerID, userID, source}
					t.pending[k] += elapsed
					t.touched[k] = true
				}
			}
		}
		add(SourceVoice, s.Voice)
		add(SourceStream, streamers(s))
		add(SourceWatch, watchers(s))
		add(SourcePresence, crowd(s, real))
	}
}

// streamers (Streamer): quem transmite com mais alguém ouvindo.
func streamers(s call.CallSnapshot) []string {
	var out []string
	for _, userID := range s.ScreenSharers {
		if hasOtherListener(s.Listeners, userID) {
			out = append(out, userID)
		}
	}
	return out
}

// watchers (Espectador): quem assiste à live de outra pessoa sem estar surdo.
func watchers(s call.CallSnapshot) []string {
	var out []string
	for _, userID := range s.ScreenWatchers {
		if contains(s.Listeners, userID) {
			out = append(out, userID)
		}
	}
	return out
}

// crowd (Festeiro): na call cheia (presenceMin contas reais ouvindo e sem
// AFK), todas elas; senão ninguém.
func crowd(s call.CallSnapshot, real map[string]bool) []string {
	var out []string
	for _, userID := range s.Listeners {
		if real[userID] && !contains(s.Away, userID) {
			out = append(out, userID)
		}
	}
	if len(out) < presenceMin {
		return nil
	}
	return out
}

func contains(ids []string, userID string) bool {
	for _, id := range ids {
		if id == userID {
			return true
		}
	}
	return false
}

func hasOtherListener(listeners []string, userID string) bool {
	for _, id := range listeners {
		if id != userID {
			return true
		}
	}
	return false
}

// drain devolve os minutos completos em XP. O resto (< 1 min) fica para o
// próximo, só de quem continua somando: quem saiu perde o que não fechou.
func (t *tracker) drain() []grant {
	var out []grant
	for k, d := range t.pending {
		if !t.touched[k] {
			delete(t.pending, k)
			continue
		}
		minutes := int64(d / time.Minute)
		t.pending[k] = d - time.Duration(minutes)*time.Minute
		if minutes > 0 {
			out = append(out, grant{k.serverID, k.userID, k.source, minutes * xpPerMinute[k.source]})
		}
	}
	t.touched = make(map[key]bool)
	return out
}

// restore devolve XP que não conseguiu ser gravado, para ir no próximo flush.
func (t *tracker) restore(g grant) {
	k := key{g.serverID, g.userID, g.source}
	t.pending[k] += time.Duration(g.xp/xpPerMinute[g.source]) * time.Minute
	t.touched[k] = true
}
