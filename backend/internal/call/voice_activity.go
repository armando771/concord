package call

import (
	"sort"
	"time"
)

// speakingGrace: quem falou nos últimos segundos ainda conta como falando
// (cobre o intervalo entre as checagens do XP e as pausas de respiração).
const speakingGrace = 10 * time.Second

// VoiceActivity é alguém que está, neste momento, participando de verdade de
// uma chamada (é o que conta para o XP de voz).
type VoiceActivity struct {
	UserID   string
	CallID   string
	ServerID *string
	// Teve voz captada há pouco; sem voz, o tempo não rende XP.
	Speaking bool
}

// ActiveVoiceUsers lista quem está desmutado e sendo ouvido nas chamadas
// ativas, dizendo se essa pessoa está de fato falando.
func (s *Service) ActiveVoiceUsers() []VoiceActivity {
	return s.activeVoiceUsersAt(time.Now())
}

func (s *Service) activeVoiceUsersAt(now time.Time) []VoiceActivity {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var active []VoiceActivity
	for callID, ac := range s.calls {
		for _, userID := range eligibleVoiceUsers(ac) {
			active = append(active, VoiceActivity{
				UserID:   userID,
				CallID:   callID,
				ServerID: ac.info.ServerID,
				Speaking: spokeRecently(ac.participants[userID], now),
			})
		}
	}
	return active
}

func spokeRecently(p *participantState, now time.Time) bool {
	if p == nil {
		return false
	}
	return p.speaking || (!p.lastSpokeAt.IsZero() && now.Sub(p.lastSpokeAt) <= speakingGrace)
}

// SetSpeaking registra se o participante está com voz captada agora.
func (s *Service) SetSpeaking(callID string, userID string, speaking bool, now time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	ac, ok := s.calls[callID]
	if !ok || ac.info.Status == StatusEnded {
		return ErrNotFound
	}
	p, ok := ac.participants[userID]
	if !ok {
		return ErrNotAllowed
	}
	// Mutado o microfone não capta nada; ignora aviso atrasado.
	p.speaking = speaking && !p.muted && !p.deafened
	p.lastSpokeAt = now
	return nil
}

// eligibleVoiceUsers aplica as regras do XP de voz numa chamada:
//   - a chamada precisa estar ativa (tocando não conta);
//   - a pessoa não pode estar com o microfone mutado nem surda;
//   - precisa haver mais alguém ouvindo (não surdo) — ficar sozinho na call
//     não rende XP.
//
// Se ela está falando de fato é decidido à parte (spokeRecently).
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
