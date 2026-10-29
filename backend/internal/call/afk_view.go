package call

import (
	"encoding/json"
	"time"
)

// O que o XP de voz (internal/level) e os badges (internal/badge) leem do
// AFK no lugar do call.Service: as mesmas fotos, sem quem está AFK ganhando.

// ActiveVoiceUsers: os elegíveis ao XP de voz que falaram nos últimos 10 min
// (também é quem conta para o buff da call).
func (a *AFK) ActiveVoiceUsers() []VoiceActivity {
	all := a.src.ActiveVoiceUsers()
	now := a.now()
	a.mu.Lock()
	defer a.mu.Unlock()
	active := make([]VoiceActivity, 0, len(all))
	for _, v := range all {
		if !a.awayLocked(v.UserID, v.JoinedAt, now) {
			active = append(active, v)
		}
	}
	return active
}

// CallSnapshots: as calls com Away preenchido e quem está AFK fora de Voice,
// ScreenSharers e ScreenWatchers. Participants e Listeners ficam inteiros
// ("mais alguém ouvindo" não muda).
func (a *AFK) CallSnapshots() []CallSnapshot {
	snaps := a.src.CallSnapshots()
	now := a.now()
	a.mu.Lock()
	defer a.mu.Unlock()
	a.pruneLocked(now)
	for i := range snaps {
		a.markAwayLocked(&snaps[i], now)
	}
	return snaps
}

func (a *AFK) markAwayLocked(s *CallSnapshot, now time.Time) {
	away := make(map[string]bool)
	for _, userID := range s.Participants {
		if a.awayLocked(userID, s.JoinedAt[userID], now) {
			away[userID] = true
			s.Away = append(s.Away, userID)
		}
	}
	if len(away) == 0 {
		return
	}
	s.Voice = without(s.Voice, away)
	s.ScreenSharers = without(s.ScreenSharers, away)
	s.ScreenWatchers = without(s.ScreenWatchers, away)
}

func without(ids []string, drop map[string]bool) []string {
	var out []string
	for _, id := range ids {
		if !drop[id] {
			out = append(out, id)
		}
	}
	return out
}

// callMessageRouter é quem trata as mensagens "call:*" do WebSocket (o
// call.Service); o mesmo contrato de websocket.CallRouter.
type callMessageRouter interface {
	HandleCallMessage(userID string, evType string, payload json.RawMessage)
	IsParticipant(callID string, userID string) bool
}

// SpeakingRouter manda "call:speaking" para o AFK e o resto para o call.
type SpeakingRouter struct {
	callMessageRouter
	afk *AFK
}

// Router embrulha o roteador de chamadas do WebSocket.
func (a *AFK) Router(next callMessageRouter) SpeakingRouter {
	return SpeakingRouter{callMessageRouter: next, afk: a}
}

func (r SpeakingRouter) HandleCallMessage(userID string, evType string, payload json.RawMessage) {
	if evType == "call:speaking" {
		r.afk.HandleSpeaking(userID, payload)
		return
	}
	r.callMessageRouter.HandleCallMessage(userID, evType, payload)
}
