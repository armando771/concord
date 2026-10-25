package call

import "sort"

// CallSnapshot é uma foto de uma chamada ativa agora (usada pelos badges:
// tempo transmitindo, call de madrugada, maior call, maratona).
type CallSnapshot struct {
	CallID string
	// Todo mundo que está na chamada, mutado ou não.
	Participants []string
	// Quem conta como "em call de verdade" (as mesmas regras do XP de voz).
	Voice []string
	// Quem está compartilhando a tela.
	ScreenSharers []string
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
		for userID := range ac.participants {
			snap.Participants = append(snap.Participants, userID)
		}
		for userID := range s.screenSharers[callID] {
			if _, ok := ac.participants[userID]; ok {
				snap.ScreenSharers = append(snap.ScreenSharers, userID)
			}
		}
		sort.Strings(snap.Participants)
		sort.Strings(snap.ScreenSharers)
		snaps = append(snaps, snap)
	}
	sort.Slice(snaps, func(i, j int) bool { return snaps[i].CallID < snaps[j].CallID })
	return snaps
}
