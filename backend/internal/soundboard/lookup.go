package soundboard

import (
	"context"

	"gin-quickstart/backend/internal/call"
)

type CallLookup struct {
	repo soundRepo
}

func NewCallLookup(repo soundRepo) *CallLookup {
	return &CallLookup{repo: repo}
}

func (l *CallLookup) FindSound(ctx context.Context, soundID string) (call.SoundInfo, error) {
	s, err := l.repo.FindByID(ctx, soundID)
	if err != nil {
		return call.SoundInfo{}, err
	}
	return call.SoundInfo{
		ID:         s.ID,
		ServerID:   s.ServerID,
		Name:       s.Name,
		Emoji:      s.Emoji,
		DurationMs: s.DurationMs,
	}, nil
}
