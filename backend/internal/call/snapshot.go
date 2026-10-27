package call

import "sort"

// CallSnapshot é uma foto de uma chamada ativa agora (usada pelos badges:
// tempo transmitindo, tempo assistindo, call de madrugada, maior call,
// maratona).
type CallSnapshot struct {
	CallID string
	// Todo mundo que está na chamada, mutado ou não.
	Participants []string
	// Quem conta como "em call de verdade" (as mesmas regras do XP de voz).
	Voice []string
	// Quem não está surdo (está ouvindo), como os ouvintes do XP.
	Listeners []string
	// Quem está compartilhando a tela.
	ScreenSharers []string
	// Quem está assistindo à transmissão de outra pessoa (a própria não
	// conta), uma vez só mesmo vendo duas lives.
	ScreenWatchers []string
}

// CallSnapshots lista as chamadas ativas (tocando não conta), com os ids em
// ordem alfabética.
func (s *Service) CallSnapshots() []CallSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var snaps []CallSnapshot
	for callID, ac := range s.calls {
		if ac.info.Status != StatusActive {
			continue
		}
		snap := CallSnapshot{CallID: callID, Voice: eligibleVoiceUsers(ac)}
		for userID, p := range ac.participants {
			snap.Participants = append(snap.Participants, userID)
			if !p.deafened {
				snap.Listeners = append(snap.Listeners, userID)
			}
		}
		for userID := range s.screenSharers[callID] {
			if _, ok := ac.participants[userID]; ok {
				snap.ScreenSharers = append(snap.ScreenSharers, userID)
			}
		}
		snap.ScreenWatchers = liveWatchersLocked(ac, s.screenSharers[callID])
		sort.Strings(snap.Participants)
		sort.Strings(snap.Listeners)
		sort.Strings(snap.ScreenSharers)
		snaps = append(snaps, snap)
	}
	sort.Slice(snaps, func(i, j int) bool { return snaps[i].CallID < snaps[j].CallID })
	return snaps
}

// liveWatchersLocked lista, em ordem, quem está na chamada assistindo a uma
// transmissão ativa de outra pessoa.
func liveWatchersLocked(ac *activeCall, sharers map[string]struct{}) []string {
	seen := make(map[string]bool)
	var out []string
	for sharerID, watchers := range ac.screenWatchers {
		if _, live := sharers[sharerID]; !live {
			continue
		}
		for watcherID := range watchers {
			if watcherID == sharerID || seen[watcherID] || ac.participants[watcherID] == nil {
				continue
			}
			seen[watcherID] = true
			out = append(out, watcherID)
		}
	}
	sort.Strings(out)
	return out
}
