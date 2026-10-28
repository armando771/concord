package guest

import (
	"context"
	"time"

	"gin-quickstart/backend/internal/permission"
)

// CreatedInvite: o convite e o token (o link só aparece nesta resposta).
type CreatedInvite struct {
	Invite
	Token string `json:"token"`
}

// InviteGuest: quem entrou por um convite (lista de quem gerencia).
type InviteGuest struct {
	InviteID    string     `json:"-"`
	UserID      string     `json:"user_id"`
	DisplayName string     `json:"display_name"`
	AvatarURL   *string    `json:"avatar_url,omitempty"`
	EndedAt     *time.Time `json:"ended_at,omitempty"`
}

// InviteSummary: um link ativo e quem entrou por ele.
type InviteSummary struct {
	Invite
	CanSpeak  bool          `json:"can_speak"`
	CanStream bool          `json:"can_stream"`
	Guests    []InviteGuest `json:"guests"`
}

// Preview: o que a página do link mostra antes de entrar (sem login). Nada de
// ids nem de lista de membros.
type Preview struct {
	ServerName  string    `json:"server_name"`
	ChannelName string    `json:"channel_name"`
	InviterName string    `json:"inviter_name"`
	ExpiresAt   time.Time `json:"expires_at"`
	CanSpeak    bool      `json:"can_speak"`
	CanStream   bool      `json:"can_stream"`
}

// PassView: o acesso visto pelo próprio visitante.
type PassView struct {
	ServerID    string    `json:"server_id"`
	ServerName  string    `json:"server_name"`
	ChannelID   string    `json:"channel_id"`
	ChannelName string    `json:"channel_name"`
	ExpiresAt   time.Time `json:"expires_at"`
	CanSpeak    bool      `json:"can_speak"`
	CanStream   bool      `json:"can_stream"`
}

// SessionUser: o usuário efêmero do visitante sem conta.
type SessionUser struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
}

// Session: a sessão do visitante sem conta (token de visitante e o acesso).
type Session struct {
	Token string      `json:"token"`
	User  SessionUser `json:"user"`
	Pass  PassView    `json:"pass"`
}

func (s *Service) channelName(ctx context.Context, id string) string {
	ch, err := s.dir.Channel(ctx, id)
	if err != nil {
		return ""
	}
	return ch.Name
}

func (s *Service) passView(ctx context.Context, p Pass) PassView {
	return PassView{
		ServerID:    p.ServerID,
		ServerName:  s.dir.ServerName(ctx, p.ServerID),
		ChannelID:   p.ChannelID,
		ChannelName: s.channelName(ctx, p.ChannelID),
		ExpiresAt:   p.ExpiresAt,
		CanSpeak:    p.Permissions&permission.Speak != 0,
		CanStream:   p.Permissions&permission.Stream != 0,
	}
}

// Preview: a prévia do link (para quem ainda não entrou).
func (s *Service) Preview(ctx context.Context, token string) (*Preview, error) {
	inv, err := s.openInvite(ctx, token)
	if err != nil {
		return nil, err
	}
	return &Preview{
		ServerName:  s.dir.ServerName(ctx, inv.ServerID),
		ChannelName: s.channelName(ctx, inv.ChannelID),
		InviterName: s.dir.DisplayName(ctx, inv.CreatedBy),
		ExpiresAt:   inv.ExpiresAt,
		CanSpeak:    inv.Permissions&permission.Speak != 0,
		CanStream:   inv.Permissions&permission.Stream != 0,
	}, nil
}
