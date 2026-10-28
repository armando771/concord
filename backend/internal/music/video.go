package music

// Vídeo da música: baixado só para quem está assistindo. Extraído do
// player.go.

import (
	"context"
	"log"
)

func (p *Player) SetWatching(userID string, watching bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if watching {
		p.watchers[userID] = struct{}{}
	} else {
		delete(p.watchers, userID)
	}
	p.ensureVideosLocked()
}

// ensureVideosLocked: vídeo só é baixado se alguém está assistindo, para a
// atual e a próxima.
func (p *Player) ensureVideosLocked() {
	if len(p.watchers) == 0 || p.closed {
		return
	}
	for _, it := range []*Item{p.now, p.queue.Head()} {
		if it == nil || !it.Track.HasVideo || it.VideoPath != "" || p.videoJobs[it.ID] {
			continue
		}
		p.videoJobs[it.ID] = true
		go func(it *Item) {
			ctx, cancel := context.WithTimeout(p.ctx, downloadTimeout)
			defer cancel()
			path, err := p.deps.Source.DownloadVideo(ctx, it.Track.VideoID, p.deps.CacheDir)
			p.mu.Lock()
			defer p.mu.Unlock()
			delete(p.videoJobs, it.ID)
			if err != nil {
				log.Printf("[music] vídeo de %s: %v", it.Track.VideoID, err)
				return
			}
			it.VideoPath = path
			if !p.closed {
				p.deps.Notify.PublishState(p)
			}
		}(it)
	}
}

func (p *Player) VideoPath(itemID string) (string, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	for _, it := range append([]*Item{p.now}, p.queue.Items()...) {
		if it != nil && it.ID == itemID && it.VideoPath != "" {
			return it.VideoPath, true
		}
	}
	return "", false
}
