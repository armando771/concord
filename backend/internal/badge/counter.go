package badge

import (
	"context"
	"log"
	"time"
)

// counterColumns: badges contados por evento que o backend vê (e não por
// trigger nem COUNT), com a coluna de user_badge_stats de cada um.
var counterColumns = map[string]string{
	"dj":         "songs_queued",
	"barulhento": "sounds_played",
}

// Gravar a contagem não pode travar quem a disparou (o comando do Maestro).
const countTimeout = 3 * time.Second

// Count soma n à contagem de category e, se cruzou o limite de um tier,
// reavalia os badges na hora (e avisa o desbloqueio). Falha só é registrada.
func (s *Service) Count(ctx context.Context, userID, category string, n int64) {
	c, ok := catalogCategory(category)
	if _, counted := counterColumns[category]; !ok || !counted || n <= 0 {
		return
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), countTimeout)
	defer cancel()
	total, err := s.store.AddCount(ctx, userID, category, n)
	if err != nil {
		log.Printf("[badge] contar %s de %s: %v", category, userID, err)
		return
	}
	if crossedTier(c, total-n, total) {
		s.Refresh(ctx, userID)
	}
}

// crossedTier diz se a contagem passou por algum limite indo de before a after.
func crossedTier(c Category, before, after int64) bool {
	for _, t := range c.Tiers {
		if before < t.Threshold && t.Threshold <= after {
			return true
		}
	}
	return false
}

func catalogCategory(key string) (Category, bool) {
	for _, c := range Catalog {
		if c.Key == key {
			return c, true
		}
	}
	return Category{}, false
}
