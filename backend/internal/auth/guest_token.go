package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// TokenGuest é o tipo do token do visitante sem conta (convite de visitante
// para uma call, docs/adr/0017-visitante-na-call.md). Ele só abre as rotas da
// call (MemberOrGuestMiddleware) e o WebSocket; o AuthMiddleware recusa.
const TokenGuest = "guest"

var ErrGuestAccessOver = errors.New("o acesso de visitante já acabou")

// GenerateGuestToken emite o token do visitante, válido até o fim do acesso
// dele (não há renovação: acabou o prazo, acabou a sessão).
func (s *Service) GenerateGuestToken(userID string, until time.Time) (string, error) {
	now := time.Now()
	if !until.After(now) {
		return "", ErrGuestAccessOver
	}
	claims := Claims{
		UserID: userID,
		Type:   TokenGuest,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(until),
			IssuedAt:  jwt.NewNumericDate(now),
			ID:        uuid.New().String(),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.secret)
}
