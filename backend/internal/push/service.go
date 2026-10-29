package push

import (
	"context"
	"errors"
	"strings"
)

var ErrInvalidToken = errors.New("token de push inválido")

const (
	maxTokenLength  = 4096
	platformAndroid = "android"
)

// tokenStore é o que o serviço precisa do banco para guardar os tokens FCM dos aparelhos.
type tokenStore interface {
	Upsert(ctx context.Context, userID, token, platform string) error
	DeleteForUser(ctx context.Context, userID, token string) error
}

type service struct{ store tokenStore }

func NewService(store tokenStore) *service { return &service{store: store} }

func (s *service) Register(ctx context.Context, userID, token, platform string) error {
	token = strings.TrimSpace(token)
	if userID == "" || token == "" || len(token) > maxTokenLength || platform != platformAndroid {
		return ErrInvalidToken
	}
	return s.store.Upsert(ctx, userID, token, platform)
}

func (s *service) Unregister(ctx context.Context, userID, token string) error {
	token = strings.TrimSpace(token)
	if userID == "" || token == "" {
		return ErrInvalidToken
	}
	return s.store.DeleteForUser(ctx, userID, token)
}
