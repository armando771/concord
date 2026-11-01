// Package guest cuida do convite de visitante para uma call: o link que põe
// alguém de fora do servidor só no canal de voz em que o convidador está, por
// tempo limitado (docs/adr/0017-visitante-na-call.md).
package guest

import (
	"errors"
	"time"

	"gin-quickstart/backend/internal/permission"
)

// Durations: os prazos que dá para escolher ao gerar o link. O link e o acesso
// de quem entrou acabam juntos, no fim do prazo.
var Durations = map[string]time.Duration{
	"2h":  2 * time.Hour,
	"6h":  6 * time.Hour,
	"12h": 12 * time.Hour,
	"24h": 24 * time.Hour,
}

// MaxGuestsPerInvite: quantas pessoas diferentes entram por um mesmo link.
const MaxGuestsPerInvite = 10

// AllowedPerms: o que o convite pode liberar além de ouvir e assistir (que
// valem sempre): falar e transmitir (câmera e tela, como o STREAM dos cargos).
const AllowedPerms = permission.Speak | permission.Stream

// basePerms: o mínimo do visitante no canal do convite (ver e entrar).
const basePerms = permission.ViewChannel | permission.Connect

var (
	ErrNotFound          = errors.New("convite de visitante não encontrado")
	ErrInvalidDuration   = errors.New("escolha 2h, 6h, 12h ou 1 dia")
	ErrNotVoiceChannel   = errors.New("o convite de visitante é só para canais de voz")
	ErrNotInCall         = errors.New("entre na call para convidar um visitante")
	ErrMissingPermission = permission.ErrMissingPermission
	ErrNotMember         = permission.ErrNotMember
	ErrInvalidName       = errors.New("o nome precisa ter de 2 a 32 caracteres")
	ErrInviteFull        = errors.New("este link já foi usado pelo número máximo de visitantes")
	ErrAccessEnded       = errors.New("seu acesso de visitante foi encerrado")
	ErrAlreadyMember     = errors.New("você já é membro deste servidor")
)

// Invite é o link gerado. Só o hash do token fica no banco.
type Invite struct {
	ID          string     `json:"id"`
	ServerID    string     `json:"server_id"`
	ChannelID   string     `json:"channel_id"`
	CreatedBy   string     `json:"created_by"`
	Permissions int64      `json:"permissions"`
	ExpiresAt   time.Time  `json:"expires_at"`
	RevokedAt   *time.Time `json:"revoked_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

// usable: o link ainda abre (não revogado e dentro do prazo).
func (i *Invite) usable(now time.Time) bool {
	return i.RevokedAt == nil && now.Before(i.ExpiresAt)
}

// Pass é o acesso de uma pessoa que entrou pelo link. ServerID, Permissions e
// ExpiresAt vêm do convite.
type Pass struct {
	ID          string    `json:"id"`
	InviteID    string    `json:"invite_id"`
	UserID      string    `json:"user_id"`
	ServerID    string    `json:"server_id"`
	ChannelID   string    `json:"channel_id"`
	Permissions int64     `json:"permissions"`
	ExpiresAt   time.Time `json:"expires_at"`
	// EndedAt: expulso, link revogado ou prazo vencido (o sweep marca).
	EndedAt *time.Time `json:"ended_at,omitempty"`
}

// channelPerms: o que o visitante pode no canal permitido.
func (p Pass) channelPerms() int64 {
	return basePerms | (p.Permissions & AllowedPerms)
}

// GuestUser é o usuário efêmero do visitante sem conta.
type GuestUser struct {
	ID          string
	Username    string
	DisplayName string
	Email       string
}

// Ended: motivos do fim do acesso (vão no evento guest:ended).
const (
	EndExpired = "expired"
	EndRevoked = "revoked"
	EndRemoved = "removed"
)

// EndedEvent avisa o visitante de que o acesso acabou (o app mostra a tela de
// fim e descarta a sessão de visitante).
type EndedEvent struct {
	ServerID string `json:"server_id"`
	Reason   string `json:"reason"`
}
