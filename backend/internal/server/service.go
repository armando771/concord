package server

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

var (
	ErrInviteNotFound   = errors.New("invite not found")
	ErrNotInvitee       = errors.New("you are not the invitee")
	ErrInviteNotPending = errors.New("invite is not pending")
	ErrAlreadyMember    = errors.New("you are already a member of this server")
	ErrInvalidCode      = errors.New("código de convite inválido")
	ErrNotServerMember  = errors.New("you are not a member of this server")
)

type EventPublisher interface {
	PublishServerUpdate(event UpdateEvent)
	PublishServerDelete(event DeleteEvent)
	PublishMemberJoin(event MemberJoinEvent)
	PublishMemberLeave(event MemberLeaveEvent)
	PublishMemberUpdate(event MemberJoinEvent)
}

type Service struct {
	repository *Repository
	publisher  EventPublisher
}

func ServerService(repository *Repository, publisher EventPublisher) *Service {
	return &Service{
		repository: repository,
		publisher:  publisher,
	}
}

func (s *Service) Create(
	ctx context.Context,
	server *Server,
) error {
	if server.Name == "" {
		return errors.New("name is required")
	}

	if server.OwnerID == "" {
		return errors.New("owner_id is required")
	}

	server.ID = uuid.New().String()

	if err := s.repository.Create(ctx, server); err != nil {
		return err
	}

	member := &ServerMember{}
	if err := s.repository.AddingUserServer(ctx, server, member, server.OwnerID, "admin"); err != nil {
		return err
	}

	fullMember, err := s.repository.FindMemberByUserID(ctx, server.ID, server.OwnerID)
	if err == nil && s.publisher != nil {
		s.publisher.PublishMemberJoin(MemberJoinEvent{
			ServerID: server.ID,
			Member:   *fullMember,
		})
	}

	return nil
}

func (s *Service) FindByID(ctx context.Context, id string) (*Server, error) {
	return s.repository.FindByID(ctx, id)
}

func (s *Service) Update(ctx context.Context, id string, name string, iconURL string) (*Server, error) {
	if name == "" {
		return nil, errors.New("name is required")
	}

	srv, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return nil, errors.New("server not found")
	}

	if err := s.repository.Update(ctx, id, name, iconURL); err != nil {
		return nil, err
	}

	updated, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if s.publisher != nil {
		s.publisher.PublishServerUpdate(UpdateEvent{
			ServerID: srv.ID,
			Server:   *updated,
		})
	}

	return updated, nil
}

func (s *Service) Delete(ctx context.Context, id string) error {
	srv, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return errors.New("server not found")
	}

	if err := s.repository.Delete(ctx, id); err != nil {
		return err
	}

	if s.publisher != nil {
		s.publisher.PublishServerDelete(DeleteEvent{
			ServerID: srv.ID,
		})
	}

	return nil
}

func (s *Service) ListByUserID(ctx context.Context, userID string) ([]Server, error) {
	return s.repository.ListByUserID(ctx, userID)
}

func (s *Service) ListMembers(ctx context.Context, serverID string) ([]ServerMember, error) {
	return s.repository.ListMembers(ctx, serverID)
}

func (s *Service) IsMember(ctx context.Context, serverID string, userID string) (bool, error) {
	return s.repository.IsMember(ctx, serverID, userID)
}

func (s *Service) InviteUser(ctx context.Context, serverID string, inviterID string, inviteeID string) error {
	invite := &ServerInvite{
		ID:        uuid.New().String(),
		ServerID:  serverID,
		InviterID: inviterID,
		InviteeID: inviteeID,
	}
	return s.repository.CreateInvite(ctx, invite)
}

func (s *Service) FindPendingInvite(ctx context.Context, serverID string, inviteeID string) (*ServerInvite, error) {
	return s.repository.FindPendingInvite(ctx, serverID, inviteeID)
}

func (s *Service) ListInvitesByInvitee(ctx context.Context, inviteeID string) ([]ServerInvite, error) {
	return s.repository.ListInvitesByInvitee(ctx, inviteeID)
}

func (s *Service) ListInvitesByServer(ctx context.Context, serverID string) ([]ServerInvite, error) {
	return s.repository.ListInvitesByServer(ctx, serverID)
}

func (s *Service) AcceptInvite(ctx context.Context, inviteID string, userID string) error {
	invite, err := s.repository.FindInviteByID(ctx, inviteID)
	if err != nil {
		return ErrInviteNotFound
	}

	if invite.InviteeID != userID {
		return ErrNotInvitee
	}

	if invite.Status != "pending" {
		return ErrInviteNotPending
	}

	isMember, err := s.repository.IsMember(ctx, invite.ServerID, userID)
	if err != nil {
		return err
	}
	if isMember {
		return ErrAlreadyMember
	}

	member := &ServerMember{}
	if err := s.repository.AddingUserServer(ctx, &Server{ID: invite.ServerID}, member, userID, "member"); err != nil {
		return err
	}

	if err := s.repository.UpdateInviteStatus(ctx, inviteID, "accepted"); err != nil {
		return err
	}

	fullMember, err := s.repository.FindMemberByUserID(ctx, invite.ServerID, userID)
	if err == nil && s.publisher != nil {
		s.publisher.PublishMemberJoin(MemberJoinEvent{
			ServerID: invite.ServerID,
			Member:   *fullMember,
		})
	}

	return nil
}

// InviteCode devolve o código de convite do servidor, criando na primeira vez.
// Qualquer membro pode ver e compartilhar.
func (s *Service) InviteCode(ctx context.Context, serverID string, userID string) (string, error) {
	isMember, err := s.repository.IsMember(ctx, serverID, userID)
	if err != nil {
		return "", err
	}
	if !isMember {
		return "", ErrNotServerMember
	}

	code, err := s.repository.InviteCode(ctx, serverID)
	if err != nil || code != "" {
		return code, err
	}
	if err := s.repository.SetInviteCodeIfMissing(ctx, serverID, newInviteCode()); err != nil {
		return "", err
	}
	return s.repository.InviteCode(ctx, serverID)
}

// JoinByCode coloca o usuário no servidor do código. Já sendo membro, só
// devolve o servidor (entrar de novo não é erro).
func (s *Service) JoinByCode(ctx context.Context, rawCode string, userID string) (*Server, error) {
	code := normalizeInviteCode(rawCode)
	if code == "" {
		return nil, ErrInvalidCode
	}
	serverID, err := s.repository.FindIDByInviteCode(ctx, code)
	if err != nil {
		return nil, ErrInvalidCode
	}

	isMember, err := s.repository.IsMember(ctx, serverID, userID)
	if err != nil {
		return nil, err
	}
	if !isMember {
		member := &ServerMember{}
		if err := s.repository.AddingUserServer(ctx, &Server{ID: serverID}, member, userID, "member"); err != nil {
			return nil, err
		}
		fullMember, err := s.repository.FindMemberByUserID(ctx, serverID, userID)
		if err == nil && s.publisher != nil {
			s.publisher.PublishMemberJoin(MemberJoinEvent{ServerID: serverID, Member: *fullMember})
		}
	}

	return s.repository.FindByID(ctx, serverID)
}

// SetMemberRole: o dono torna alguém moderador ou membro comum.
func (s *Service) SetMemberRole(ctx context.Context, serverID, actorID, targetID, role string) (*ServerMember, error) {
	server, err := s.repository.FindByID(ctx, serverID)
	if err != nil {
		return nil, err
	}
	if err := validateRoleChange(actorID, server.OwnerID, targetID, role); err != nil {
		return nil, err
	}
	if err := s.repository.UpdateMemberRole(ctx, serverID, targetID, role); err != nil {
		return nil, err
	}
	member, err := s.repository.FindMemberByUserID(ctx, serverID, targetID)
	if err != nil {
		return nil, err
	}
	if s.publisher != nil {
		s.publisher.PublishMemberUpdate(MemberJoinEvent{ServerID: serverID, Member: *member})
	}
	return member, nil
}

// CanDirectMessage: DM é liberada entre amigos ou entre quem divide um
// servidor (como no Discord). Aqui só a parte do servidor.
func (s *Service) SharesServer(ctx context.Context, userA string, userB string) (bool, error) {
	return s.repository.SharesServer(ctx, userA, userB)
}

func (s *Service) DeclineInvite(ctx context.Context, inviteID string, userID string) error {
	invite, err := s.repository.FindInviteByID(ctx, inviteID)
	if err != nil {
		return ErrInviteNotFound
	}

	if invite.InviteeID != userID {
		return ErrNotInvitee
	}

	if invite.Status != "pending" {
		return ErrInviteNotPending
	}

	return s.repository.UpdateInviteStatus(ctx, inviteID, "declined")
}
