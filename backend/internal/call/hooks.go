package call

// Ganchos para quem observa as chamadas de fora (internal/music) e consultas
// simples de participantes. Extraído do service.go.

// OnParticipantLeft registra quem quer saber que alguém saiu de uma chamada.
func (s *Service) OnParticipantLeft(fn func(callID, userID string)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onParticipantLeft = append(s.onParticipantLeft, fn)
}

// OnCallEnded registra quem quer saber que uma chamada acabou.
func (s *Service) OnCallEnded(fn func(callID string)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onCallEnded = append(s.onCallEnded, fn)
}

// ParticipantIDs: quem está na chamada, na ordem de entrada.
func (s *Service) ParticipantIDs(callID string) []string {
	infos := s.participantInfos(callID)
	ids := make([]string, len(infos))
	for i, p := range infos {
		ids[i] = p.UserID
	}
	return ids
}
