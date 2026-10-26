package call

import (
	"bytes"
	"context"
	"errors"
	"image/jpeg"
	"time"
)

// Prévia da transmissão no cartão de perfil. Em vez de assinar o vídeo da
// tela (que é publicado sem simulcast, em qualidade cheia), quem transmite
// manda uma miniatura JPEG pequena só quando alguém está com o cartão aberto:
// o GET de quem olha pede uma foto nova (call:screen_preview_request) e
// devolve a mais recente. Ninguém olhando, nada é enviado.

const (
	// Foto mais nova que isso é servida sem pedir outra.
	screenPreviewFresh = 10 * time.Second
	// Foto mais velha que isso não é mostrada (a tela já mudou demais).
	screenPreviewMaxAge = time.Minute
	// Intervalo mínimo entre dois pedidos de foto à mesma pessoa.
	screenPreviewRequestEvery = 3 * time.Second
	// Intervalo mínimo entre dois envios da mesma pessoa.
	screenPreviewUploadEvery = time.Second
	// MaxScreenPreviewBytes limita a miniatura (o app manda ~20 KB).
	MaxScreenPreviewBytes = 96 << 10
	// Maior lado aceito da miniatura, em pixels.
	maxScreenPreviewSide = 640
)

var (
	ErrInvalidPreview     = errors.New("invalid_preview")
	ErrPreviewTooFrequent = errors.New("preview_too_frequent")
)

// screenPreview é a última miniatura de quem transmite (sob s.mu).
type screenPreview struct {
	image       []byte
	at          time.Time
	requestedAt time.Time
}

// ScreenPreviewRequestEvent pede a quem transmite uma miniatura nova.
type ScreenPreviewRequestEvent struct {
	CallID string `json:"call_id"`
}

// ScreenPreviewResult é o que quem abriu o cartão recebe. Image nil = a foto
// foi pedida e ainda não chegou.
type ScreenPreviewResult struct {
	Image []byte
	At    time.Time
}

// validPreview confere que a miniatura é um JPEG pequeno de verdade.
func validPreview(image []byte) bool {
	if len(image) == 0 || len(image) > MaxScreenPreviewBytes {
		return false
	}
	cfg, err := jpeg.DecodeConfig(bytes.NewReader(image))
	if err != nil {
		return false
	}
	return cfg.Width > 0 && cfg.Height > 0 &&
		cfg.Width <= maxScreenPreviewSide && cfg.Height <= maxScreenPreviewSide
}

// SaveScreenPreview guarda a miniatura de quem está transmitindo nessa chamada.
func (s *Service) SaveScreenPreview(callID, userID string, image []byte, now time.Time) error {
	if !validPreview(image) {
		return ErrInvalidPreview
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	ac, ok := s.calls[callID]
	if !ok || ac.info.Status == StatusEnded {
		return ErrNotFound
	}
	if _, ok := ac.participants[userID]; !ok {
		return ErrNotAllowed
	}
	if _, sharing := s.screenSharers[callID][userID]; !sharing {
		return ErrStreamNotActive
	}
	if ac.screenPreviews == nil {
		ac.screenPreviews = make(map[string]*screenPreview)
	}
	prev := ac.screenPreviews[userID]
	if prev == nil {
		prev = &screenPreview{}
		ac.screenPreviews[userID] = prev
	} else if prev.image != nil && now.Sub(prev.at) < screenPreviewUploadEvery {
		return ErrPreviewTooFrequent
	}
	prev.image = append([]byte(nil), image...)
	prev.at = now
	return nil
}

// canSeePreview: quem está na chamada vê; de fora, só numa chamada de canal
// destrancada em que poderia entrar (VIEW + CONNECT).
func (s *Service) canSeePreview(ctx context.Context, callID, viewerID string) error {
	s.mu.RLock()
	ac, ok := s.calls[callID]
	if !ok || ac.info.Status == StatusEnded {
		s.mu.RUnlock()
		return ErrNotFound
	}
	_, inCall := ac.participants[viewerID]
	locked := ac.info.Locked
	var channelID string
	if ac.info.Type == TypeChannel && ac.info.ChannelID != nil {
		channelID = *ac.info.ChannelID
	}
	s.mu.RUnlock()

	switch {
	case inCall:
		return nil
	case channelID == "" || locked:
		return ErrNotAllowed
	}
	if err := s.requireConnect(ctx, channelID, viewerID); err != nil {
		return ErrNotAllowed
	}
	return nil
}

// ScreenPreview devolve a miniatura de sharerID para viewerID e, se ela está
// velha (ou não existe), pede uma nova a quem transmite.
func (s *Service) ScreenPreview(ctx context.Context, callID, sharerID, viewerID string, now time.Time) (ScreenPreviewResult, error) {
	if err := s.canSeePreview(ctx, callID, viewerID); err != nil {
		return ScreenPreviewResult{}, err
	}

	s.mu.Lock()
	ac, ok := s.calls[callID]
	if !ok {
		s.mu.Unlock()
		return ScreenPreviewResult{}, ErrNotFound
	}
	_, inCall := ac.participants[sharerID]
	_, sharing := s.screenSharers[callID][sharerID]
	if !inCall || !sharing {
		s.mu.Unlock()
		return ScreenPreviewResult{}, ErrStreamNotActive
	}
	if ac.screenPreviews == nil {
		ac.screenPreviews = make(map[string]*screenPreview)
	}
	prev := ac.screenPreviews[sharerID]
	if prev == nil {
		prev = &screenPreview{}
		ac.screenPreviews[sharerID] = prev
	}
	stale := prev.image == nil || now.Sub(prev.at) >= screenPreviewFresh
	ask := stale && now.Sub(prev.requestedAt) >= screenPreviewRequestEvery
	if ask {
		prev.requestedAt = now
	}
	var result ScreenPreviewResult
	if prev.image != nil && now.Sub(prev.at) < screenPreviewMaxAge {
		result = ScreenPreviewResult{Image: prev.image, At: prev.at}
	}
	s.mu.Unlock()

	if ask {
		s.publisher.SendToUser(sharerID, marshalEvent("call:screen_preview_request", ScreenPreviewRequestEvent{CallID: callID}))
	}
	return result, nil
}
