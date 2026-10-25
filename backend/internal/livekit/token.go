package livekit

import (
	"time"

	"github.com/livekit/protocol/auth"
)

// tokenTTL cobre uma noite longa de chamada; o token só é usado para entrar
// na sala, então expirar no meio não derruba quem já está conectado.
const tokenTTL = 6 * time.Hour

// TokenIssuer emite os JWTs que o cliente apresenta ao LiveKit para entrar
// na sala de uma chamada. A sala do LiveKit tem o mesmo ID da chamada.
type TokenIssuer struct {
	apiKey    string
	apiSecret string
}

func NewTokenIssuer(apiKey, apiSecret string) *TokenIssuer {
	return &TokenIssuer{
		apiKey:    apiKey,
		apiSecret: apiSecret,
	}
}

func (t *TokenIssuer) Issue(room, identity, name string) (string, error) {
	token := auth.NewAccessToken(t.apiKey, t.apiSecret).
		SetIdentity(identity).
		SetName(name).
		SetValidFor(tokenTTL).
		SetVideoGrant(&auth.VideoGrant{
			RoomJoin: true,
			Room:     room,
		})
	return token.ToJWT()
}

// IssueBot é o token do bot de música: entra na sala e só publica áudio
// (não assina ninguém — não escuta a call).
func (t *TokenIssuer) IssueBot(room, identity, name string) (string, error) {
	canPublish, canSubscribe := true, false
	token := auth.NewAccessToken(t.apiKey, t.apiSecret).
		SetIdentity(identity).
		SetName(name).
		SetValidFor(tokenTTL).
		SetVideoGrant(&auth.VideoGrant{
			RoomJoin:          true,
			Room:              room,
			CanPublish:        &canPublish,
			CanSubscribe:      &canSubscribe,
			CanPublishSources: []string{"microphone"},
		})
	return token.ToJWT()
}
