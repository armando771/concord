package proposal

// Votos nos cards em votação. Extraído do service.go.

import "context"

// Vote registra ou troca o voto de quem está logado.
func (s *Service) Vote(ctx context.Context, id, userID string, approve bool) (*Proposal, error) {
	if _, err := s.store.Get(ctx, id, nil); err != nil {
		return nil, err
	}
	ok, err := s.store.UpsertVote(ctx, id, userID, approve, s.now())
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrVotingClosed
	}
	s.publish("proposal:update", id)
	// Votante: o voto novo pode subir o badge de quem votou.
	if s.badges != nil {
		s.badges.Refresh(ctx, userID)
	}
	return s.store.Get(ctx, id, &userID)
}

func (s *Service) RemoveVote(ctx context.Context, id, userID string) (*Proposal, error) {
	if _, err := s.store.Get(ctx, id, nil); err != nil {
		return nil, err
	}
	ok, err := s.store.DeleteVote(ctx, id, userID, s.now())
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrVotingClosed
	}
	s.publish("proposal:update", id)
	return s.store.Get(ctx, id, &userID)
}
