package soundboard

import (
	"context"

	"gin-quickstart/backend/internal/call"
)

// favoriteChecker: a pessoa favoritou o som (Repository).
type favoriteChecker interface {
	IsFavorite(ctx context.Context, userID, soundID string) (bool, error)
}

// CallLookup dá à chamada os sons e os favoritos (call.SoundLookup).
type CallLookup struct {
	repo      soundRepo
	favorites favoriteChecker
}

func NewCallLookup(repo soundRepo, favorites favoriteChecker) *CallLookup {
	return &CallLookup{repo: repo, favorites: favorites}
}

func (l *CallLookup) IsFavorite(ctx context.Context, userID, soundID string) (bool, error) {
	return l.favorites.IsFavorite(ctx, userID, soundID)
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
