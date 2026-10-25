package call

import (
	"context"
	"encoding/json"
	"errors"
	"time"
)

const soundboardCooldown = 500 * time.Millisecond

var (
	ErrSoundboardMuted       = errors.New("desative o mudo para tocar áudios na mesa")
	ErrSoundboardCooldown    = errors.New("aguarde um instante antes de tocar outro áudio")
	ErrSoundboardUnavailable = errors.New("mesa de áudio indisponível nesta chamada")
	ErrSoundNotFound         = errors.New("áudio não encontrado neste servidor")
)

type SoundInfo struct {
	ID         string  `json:"id"`
	ServerID   string  `json:"server_id"`
	Name       string  `json:"name"`
	Emoji      *string `json:"emoji,omitempty"`
	DurationMs int     `json:"duration_ms"`
}

type SoundLookup interface {
	FindSound(ctx context.Context, soundID string) (SoundInfo, error)
}

type SoundboardPayload struct {
	CallID  string `json:"call_id"`
	SoundID string `json:"sound_id"`
}

type SoundboardEvent struct {
	CallID string    `json:"call_id"`
	Sound  SoundInfo `json:"sound"`
	User   UserInfo  `json:"user"`
}

func (s *Service) SetSoundLookup(lookup SoundLookup) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.soundLookup = lookup
}

func (s *Service) TriggerSoundboard(ctx context.Context, callID, userID, soundID string) error {
	now := time.Now()

	s.mu.Lock()
	lookup := s.soundLookup
	ac, ok := s.calls[callID]
	if !ok || ac.info.Status == StatusEnded {
		s.mu.Unlock()
		return ErrNotFound
	}
	if ac.info.Type != TypeChannel || ac.info.ServerID == nil || lookup == nil {
		s.mu.Unlock()
		return ErrSoundboardUnavailable
	}
	p, ok := ac.participants[userID]
	if !ok {
		s.mu.Unlock()
		return ErrNotAllowed
	}
	if p.muted || p.deafened {
		s.mu.Unlock()
		return ErrSoundboardMuted
	}
	if !p.lastSoundAt.IsZero() && now.Sub(p.lastSoundAt) < soundboardCooldown {
		s.mu.Unlock()
		return ErrSoundboardCooldown
	}
	serverID := *ac.info.ServerID
	p.lastSoundAt = now
	s.mu.Unlock()

	sound, err := lookup.FindSound(ctx, soundID)
	if err != nil || sound.ServerID != serverID {
		return ErrSoundNotFound
	}

	userInfo, err := s.lookupUser(ctx, userID)
	if err != nil {
		return err
	}

	s.publisher.BroadcastToCall(callID, marshalEvent("call:soundboard", SoundboardEvent{
		CallID: callID,
		Sound:  sound,
		User:   userInfo,
	}))
	return nil
}

func (s *Service) handleSoundboardMessage(ctx context.Context, userID string, payload json.RawMessage) {
	var p SoundboardPayload
	if err := json.Unmarshal(payload, &p); err != nil || p.CallID == "" || p.SoundID == "" {
		s.sendError(userID, "", "invalid call:soundboard payload")
		return
	}
	if err := s.TriggerSoundboard(ctx, p.CallID, userID, p.SoundID); err != nil {
		s.sendError(userID, p.CallID, err.Error())
	}
}
