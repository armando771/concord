package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// MediaTokenTTL é a validade do token que vai na URL de <img>/<video>/<audio>
// (que não mandam Bearer). Ele só abre arquivos de mídia: o AuthMiddleware e
// o WebSocket recusam qualquer tipo que não seja "access".
const MediaTokenTTL = time.Hour

var ErrNotMediaToken = errors.New("token is not a media token")

func (s *Service) GenerateMediaToken(userID string) (string, time.Time, error) {
	now := time.Now()
	expiresAt := now.Add(MediaTokenTTL)
	claims := Claims{
		UserID: userID,
		Type:   "media",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.secret)
	if err != nil {
		return "", time.Time{}, err
	}
	return signed, expiresAt, nil
}

func (s *Service) VerifyMediaToken(token string) (string, error) {
	claims, err := s.ValidateToken(token)
	if err != nil {
		return "", err
	}
	if claims.Type != "media" {
		return "", ErrNotMediaToken
	}
	return claims.UserID, nil
}
