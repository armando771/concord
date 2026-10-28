package call

import (
	"sort"
	"time"
)

// VoiceActivity é alguém que está, neste momento, participando de verdade de
// uma chamada (é o que conta para o XP de voz).
type VoiceActivity struct {
	UserID   string
	CallID   string
	ServerID *string
	// JoinedAt: quando entrou nesta call (o AFK conta os 10 min a partir daí).
	JoinedAt time.Time
}

// ActiveVoiceUsers lista quem está falando-e-ouvindo nas chamadas ativas.
func (s *Service) ActiveVoiceUsers() []VoiceActivity {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var active []VoiceActivity
	for callID, ac := range s.calls {
		for _, userID := range eligibleVoiceUsers(ac) {
			active = append(active, VoiceActivity{
				UserID: userID, CallID: callID, ServerID: ac.info.ServerID,
				JoinedAt: ac.participants[userID].joinedAt,
			})
		}
	}
	return active
}

// eligibleVoiceUsers aplica as regras do XP de voz numa chamada:
//   - a chamada precisa estar ativa (tocando não conta);
//   - a pessoa não pode estar com o microfone mutado nem surda;
//   - precisa haver mais alguém ouvindo (não surdo) — ficar sozinho na call
//     não rende XP.
func eligibleVoiceUsers(ac *activeCall) []string {
	if ac.info.Status != StatusActive {
		return nil
	}

	listeners := 0
	for _, p := range ac.participants {
		if !p.deafened {
			listeners++
		}
	}

	var eligible []string
	for _, p := range ac.participants {
		if p.muted || p.deafened {
			continue
		}
		// Ela mesma é uma das ouvintes; precisa de pelo menos mais uma.
		if listeners < 2 {
			continue
		}
		eligible = append(eligible, p.userID)
	}
	sort.Strings(eligible)
	return eligible
}
