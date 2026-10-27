package call

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"gin-quickstart/backend/internal/permission"
)

const soundboardCooldown = 500 * time.Millisecond

var (
	ErrSoundboardMuted        = errors.New("desative o mudo para tocar áudios na mesa")
	ErrSoundboardCooldown     = errors.New("aguarde um instante antes de tocar outro áudio")
	ErrSoundboardUnavailable  = errors.New("mesa de áudio indisponível nesta chamada")
	ErrSoundNotFound          = errors.New("áudio não encontrado neste servidor")
	ErrSoundboardNoPermission = errors.New("você não tem permissão para usar a mesa de áudio neste canal")
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

// soundboardDeps: de onde vêm os sons e quem quer saber dos tocados.
type soundboardDeps struct {
	lookup SoundLookup
	// onPlayed: som tocado com alguém ouvindo (badge Barulhento).
	onPlayed []func(callID, userID string)
}

func (s *Service) SetSoundLookup(lookup SoundLookup) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.soundboard.lookup = lookup
}

// OnSoundPlayed registra quem quer saber dos sons tocados para alguém ouvir.
func (s *Service) OnSoundPlayed(fn func(callID, userID string)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.soundboard.onPlayed = append(s.soundboard.onPlayed, fn)
}

// soundboardTarget é o que TriggerSoundboard precisa depois de soltar o lock.
type soundboardTarget struct {
	lookup    SoundLookup
	perms     PermissionSource
	serverID  string
	channelID string
	// heard: alguém além de quem tocou está ouvindo (não surdo).
	heard    bool
	onPlayed []func(callID, userID string)
}

// soundboardCheckLocked confere a chamada e quem toca (s.mu travado) e marca
// a hora do som para o intervalo mínimo.
func (s *Service) soundboardCheckLocked(callID, userID string, now time.Time) (soundboardTarget, error) {
	ac, ok := s.calls[callID]
	if !ok || ac.info.Status == StatusEnded {
		return soundboardTarget{}, ErrNotFound
	}
	if ac.info.Type != TypeChannel || ac.info.ServerID == nil || s.soundboard.lookup == nil {
		return soundboardTarget{}, ErrSoundboardUnavailable
	}
	p, ok := ac.participants[userID]
	if !ok {
		return soundboardTarget{}, ErrNotAllowed
	}
	if err := soundboardVoiceCheck(p, now); err != nil {
		return soundboardTarget{}, err
	}
	p.lastSoundAt = now
	t := soundboardTarget{
		lookup: s.soundboard.lookup, perms: s.perms, serverID: *ac.info.ServerID,
		heard: someoneElseHears(ac, userID), onPlayed: s.soundboard.onPlayed,
	}
	if ac.info.ChannelID != nil {
		t.channelID = *ac.info.ChannelID
	}
	return t, nil
}

// soundboardVoiceCheck: mudo (próprio ou de moderador) não toca, e há um
// intervalo mínimo entre dois sons.
func soundboardVoiceCheck(p *participantState, now time.Time) error {
	if p.muted || p.deafened || p.serverMuted || p.serverDeafened {
		return ErrSoundboardMuted
	}
	if !p.lastSoundAt.IsZero() && now.Sub(p.lastSoundAt) < soundboardCooldown {
		return ErrSoundboardCooldown
	}
	return nil
}

func someoneElseHears(ac *activeCall, userID string) bool {
	for id, p := range ac.participants {
		if id != userID && !p.deafened && !p.serverDeafened {
			return true
		}
	}
	return false
}

func (t soundboardTarget) allowed(ctx context.Context, userID string) bool {
	if t.perms == nil {
		return true
	}
	got, err := t.perms.ChannelPerms(ctx, t.channelID, userID)
	return err == nil && permission.Has(got, permission.UseSoundboard)
}

func (s *Service) TriggerSoundboard(ctx context.Context, callID, userID, soundID string) error {
	s.mu.Lock()
	t, err := s.soundboardCheckLocked(callID, userID, time.Now())
	s.mu.Unlock()
	if err != nil {
		return err
	}
	if !t.allowed(ctx, userID) {
		return ErrSoundboardNoPermission
	}

	sound, err := t.lookup.FindSound(ctx, soundID)
	if err != nil || sound.ServerID != t.serverID {
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
	if t.heard {
		for _, fn := range t.onPlayed {
			fn(callID, userID)
		}
	}
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
