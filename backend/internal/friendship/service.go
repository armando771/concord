package friendship

import (
	"context"
	"errors"

	"gin-quickstart/backend/internal/bot"
	"gin-quickstart/backend/internal/user"

	"github.com/jackc/pgx/v5/pgconn"
)

var (
	ErrBotUser = errors.New("o Maestro é um bot e não aceita amizade nem mensagens")
	ErrUserNotFound       = errors.New("user not found")
	ErrCannotAddSelf      = errors.New("cannot send friend request to yourself")
	ErrAlreadyFriends     = errors.New("you are already friends with this user")
	ErrFriendshipExists   = errors.New("friend request already exists")
	ErrFriendshipNotFound = errors.New("friendship not found")
	ErrNotAddressee       = errors.New("only the addressee can accept or decline")
	ErrNotRequester       = errors.New("only the requester can cancel the request")
	ErrNotPending         = errors.New("friendship is not pending")
	ErrNotFriends         = errors.New("you are not friends with this user")
	// Mesma resposta para privacidade e para "a pessoa te bloqueou": quem
	// foi bloqueado não fica sabendo.
	ErrRequestNotAllowed = errors.New("this user is not accepting friend requests from you")
	ErrYouBlocked        = errors.New("you blocked this user")
	ErrCannotBlockSelf   = errors.New("cannot block yourself")
	ErrNotBlocked        = errors.New("user is not blocked")
	ErrBlocked           = errors.New("you cannot message this user")
	ErrCannotMessage     = errors.New("you can only message friends or people from your servers")
)

// store é o que o Service usa do Repository (trocável nos testes).
type store interface {
	Create(ctx context.Context, requesterID string, addresseeID string) error
	Find(ctx context.Context, requesterID string, addresseeID string) (*Friendship, error)
	UpdateStatus(ctx context.Context, requesterID string, addresseeID string, status string) error
	Delete(ctx context.Context, requesterID string, addresseeID string) error
	ListFriends(ctx context.Context, userID string) ([]user.User, error)
	ListPending(ctx context.Context, userID string) ([]PendingRequest, error)
	ListSent(ctx context.Context, userID string) ([]PendingRequest, error)
	Block(ctx context.Context, blockerID string, blockedID string) error
	Unblock(ctx context.Context, blockerID string, blockedID string) (bool, error)
	Blocks(ctx context.Context, a string, b string) (bool, bool, error)
	ListBlocked(ctx context.Context, userID string) ([]user.User, error)
	MutualFriends(ctx context.Context, a string, b string) ([]user.User, error)
}

type userLookup interface {
	FindByID(ctx context.Context, id string) (*user.User, error)
	FindByUsername(ctx context.Context, username string) (*user.User, error)
	FindByUsernameFold(ctx context.Context, username string) (*user.User, error)
}

// ServerLookup: servidores em comum (privacidade, DM e cartão de perfil).
// Fica fora do construtor porque o pacote server já depende deste.
type ServerLookup interface {
	SharesServer(ctx context.Context, userA string, userB string) (bool, error)
}

// MutualServersFunc lista os servidores em comum para o cartão de perfil.
type MutualServersFunc func(ctx context.Context, userA string, userB string) (any, error)

type Service struct {
	repository    store
	userService   userLookup
	publisher     EventPublisher
	servers       ServerLookup
	mutualServers MutualServersFunc
}

func FriendshipService(repository *Repository, userService *user.Service, publisher EventPublisher) *Service {
	return newService(repository, userService, publisher)
}

func newService(repository store, users userLookup, publisher EventPublisher) *Service {
	return &Service{
		repository:  repository,
		userService: users,
		publisher:   publisher,
	}
}

// SetServers liga a consulta de servidores em comum.
func (s *Service) SetServers(servers ServerLookup, mutual MutualServersFunc) {
	s.servers = servers
	s.mutualServers = mutual
}

// SendRequest manda pedido pelo username (sem diferenciar maiúsculas). Se a
// outra pessoa já tinha mandado pedido, aceita na hora e devolve
// RequestAccepted.
func (s *Service) SendRequest(ctx context.Context, requesterID string, addresseeUsername string) (string, error) {
	if requesterID == "" {
		return "", errors.New("requester_id is required")
	}

	if addresseeUsername == "" {
		return "", errors.New("username is required")
	}

	addressee, err := s.userService.FindByUsernameFold(ctx, addresseeUsername)
	if err != nil {
		return "", ErrUserNotFound
	}

	if addressee.ID == bot.UserID {
		return "", ErrBotUser
	}

	if requesterID == addressee.ID {
		return "", ErrCannotAddSelf
	}

	iBlock, theyBlock, err := s.repository.Blocks(ctx, requesterID, addressee.ID)
	if err != nil {
		return "", err
	}
	if iBlock {
		return "", ErrYouBlocked
	}
	if theyBlock {
		return "", ErrRequestNotAllowed
	}

	existing, _ := s.repository.Find(ctx, requesterID, addressee.ID)
	if existing != nil {
		if existing.Status == "accepted" {
			return "", ErrAlreadyFriends
		}
		if existing.RequesterID == requesterID {
			return "", ErrFriendshipExists
		}
		// Pedido cruzado: a outra pessoa já tinha pedido.
		if err := s.AcceptRequest(ctx, requesterID, addressee.Username); err != nil {
			return "", err
		}
		return RequestAccepted, nil
	}

	if err := s.checkRequestPolicy(ctx, requesterID, addressee); err != nil {
		return "", err
	}

	if err := s.repository.Create(ctx, requesterID, addressee.ID); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return "", ErrFriendshipExists
		}
		return "", err
	}

	if s.publisher != nil {
		if requester, err := s.userService.FindByID(ctx, requesterID); err == nil {
			s.publisher.PublishFriendRequest(addressee.ID, requester)
		}
	}

	return RequestSent, nil
}

// checkRequestPolicy aplica "quem pode me mandar pedido de amizade" de quem
// recebe.
func (s *Service) checkRequestPolicy(ctx context.Context, requesterID string, addressee *user.User) error {
	switch addressee.FriendRequestPolicy {
	case "", user.FriendPolicyEveryone:
		return nil
	case user.FriendPolicyNobody:
		return ErrRequestNotAllowed
	}

	mutual, err := s.repository.MutualFriends(ctx, requesterID, addressee.ID)
	if err != nil {
		return err
	}
	if len(mutual) > 0 {
		return nil
	}

	if addressee.FriendRequestPolicy == user.FriendPolicyMutualServers && s.servers != nil {
		shares, err := s.servers.SharesServer(ctx, requesterID, addressee.ID)
		if err != nil {
			return err
		}
		if shares {
			return nil
		}
	}
	return ErrRequestNotAllowed
}

func (s *Service) AcceptRequest(ctx context.Context, addresseeID string, requesterUsername string) error {
	requester, err := s.userService.FindByUsername(ctx, requesterUsername)
	if err != nil {
		return ErrUserNotFound
	}

	friendship, err := s.repository.Find(ctx, requester.ID, addresseeID)
	if err != nil {
		return ErrFriendshipNotFound
	}

	if friendship.AddresseeID != addresseeID {
		return ErrNotAddressee
	}

	if friendship.Status != "pending" {
		return ErrNotPending
	}

	if err := s.repository.UpdateStatus(ctx, requester.ID, addresseeID, "accepted"); err != nil {
		return err
	}

	if s.publisher != nil {
		if addressee, err := s.userService.FindByID(ctx, addresseeID); err == nil {
			s.publisher.PublishFriendAccepted(requester.ID, addressee)
		}
	}

	return nil
}

func (s *Service) DeclineRequest(ctx context.Context, addresseeID string, requesterUsername string) error {
	requester, err := s.userService.FindByUsername(ctx, requesterUsername)
	if err != nil {
		return ErrUserNotFound
	}

	friendship, err := s.repository.Find(ctx, requester.ID, addresseeID)
	if err != nil {
		return ErrFriendshipNotFound
	}

	if friendship.AddresseeID != addresseeID {
		return ErrNotAddressee
	}

	if friendship.Status != "pending" {
		return ErrNotPending
	}

	if err := s.repository.Delete(ctx, requester.ID, addresseeID); err != nil {
		return err
	}

	if s.publisher != nil {
		if addressee, err := s.userService.FindByID(ctx, addresseeID); err == nil {
			s.publisher.PublishFriendDeclined(requester.ID, addressee)
		}
	}

	return nil
}

func (s *Service) CancelRequest(ctx context.Context, requesterID string, addresseeUsername string) error {
	addressee, err := s.userService.FindByUsername(ctx, addresseeUsername)
	if err != nil {
		return ErrUserNotFound
	}

	friendship, err := s.repository.Find(ctx, requesterID, addressee.ID)
	if err != nil {
		return ErrFriendshipNotFound
	}

	if friendship.RequesterID != requesterID {
		return ErrNotRequester
	}

	if friendship.Status != "pending" {
		return ErrNotPending
	}

	if err := s.repository.Delete(ctx, requesterID, addressee.ID); err != nil {
		return err
	}

	if s.publisher != nil {
		if requester, err := s.userService.FindByID(ctx, requesterID); err == nil {
			s.publisher.PublishFriendCancelled(addressee.ID, requester)
		}
	}

	return nil
}

func (s *Service) RemoveFriend(ctx context.Context, userID string, friendUsername string) error {
	friend, err := s.userService.FindByUsername(ctx, friendUsername)
	if err != nil {
		return ErrUserNotFound
	}

	friendship, err := s.repository.Find(ctx, userID, friend.ID)
	if err != nil {
		return ErrFriendshipNotFound
	}

	if friendship.Status != "accepted" {
		return ErrNotFriends
	}

	if err := s.repository.Delete(ctx, userID, friend.ID); err != nil {
		return err
	}

	if s.publisher != nil {
		me, meErr := s.userService.FindByID(ctx, userID)
		if meErr == nil {
			s.publisher.PublishFriendRemoved(friend.ID, me)
		}
		s.publisher.PublishFriendRemoved(userID, friend)
	}

	return nil
}

// Block bloqueia pelo id: desfaz amizade ou pedido (avisando a outra pessoa
// como um "removeu"/"cancelou" comum) e grava o bloqueio.
func (s *Service) Block(ctx context.Context, blockerID string, blockedID string) error {
	if blockerID == blockedID {
		return ErrCannotBlockSelf
	}

	blocked, err := s.userService.FindByID(ctx, blockedID)
	if err != nil {
		return ErrUserNotFound
	}

	existing, _ := s.repository.Find(ctx, blockerID, blockedID)

	if err := s.repository.Block(ctx, blockerID, blockedID); err != nil {
		return err
	}

	if s.publisher == nil {
		return nil
	}
	me, meErr := s.userService.FindByID(ctx, blockerID)
	if existing != nil && meErr == nil {
		switch {
		case existing.Status == "accepted":
			s.publisher.PublishFriendRemoved(blockedID, me)
			s.publisher.PublishFriendRemoved(blockerID, blocked)
		case existing.RequesterID == blockerID:
			s.publisher.PublishFriendCancelled(blockedID, me)
		default:
			s.publisher.PublishFriendDeclined(blockedID, me)
		}
	}
	s.publisher.PublishUserBlocked(blockerID, blocked)
	return nil
}

func (s *Service) Unblock(ctx context.Context, blockerID string, blockedID string) error {
	removed, err := s.repository.Unblock(ctx, blockerID, blockedID)
	if err != nil {
		return err
	}
	if !removed {
		return ErrNotBlocked
	}

	if s.publisher != nil {
		if unblocked, err := s.userService.FindByID(ctx, blockedID); err == nil {
			s.publisher.PublishUserUnblocked(blockerID, unblocked)
		}
	}
	return nil
}

func (s *Service) ListBlocked(ctx context.Context, userID string) ([]user.User, error) {
	return s.repository.ListBlocked(ctx, userID)
}

// Relationship monta a relação com outra pessoa para o cartão de perfil.
func (s *Service) Relationship(ctx context.Context, userID string, otherID string) (*Relationship, error) {
	if _, err := s.userService.FindByID(ctx, otherID); err != nil {
		return nil, ErrUserNotFound
	}

	rel := &Relationship{Type: RelationNone, MutualFriends: []user.User{}, MutualServers: []any{}}
	if userID == otherID {
		return rel, nil
	}

	iBlock, _, err := s.repository.Blocks(ctx, userID, otherID)
	if err != nil {
		return nil, err
	}
	if iBlock {
		rel.Type = RelationBlocked
	} else if f, _ := s.repository.Find(ctx, userID, otherID); f != nil {
		switch {
		case f.Status == "accepted":
			rel.Type = RelationFriend
		case f.RequesterID == userID:
			rel.Type = RelationOutgoing
		default:
			rel.Type = RelationIncoming
		}
	}

	if rel.MutualFriends, err = s.repository.MutualFriends(ctx, userID, otherID); err != nil {
		return nil, err
	}
	if s.mutualServers != nil {
		if rel.MutualServers, err = s.mutualServers(ctx, userID, otherID); err != nil {
			return nil, err
		}
	}
	return rel, nil
}

func (s *Service) ListFriends(ctx context.Context, userID string) ([]user.User, error) {
	return s.repository.ListFriends(ctx, userID)
}

func (s *Service) ListPending(ctx context.Context, userID string) ([]PendingRequest, error) {
	incoming, err := s.repository.ListPending(ctx, userID)
	if err != nil {
		return nil, err
	}

	outgoing, err := s.repository.ListSent(ctx, userID)
	if err != nil {
		return nil, err
	}

	return append(incoming, outgoing...), nil
}

func (s *Service) AreFriends(ctx context.Context, userID1 string, userID2 string) (bool, error) {
	friendship, err := s.repository.Find(ctx, userID1, userID2)
	if err != nil {
		return false, nil
	}
	return friendship.Status == "accepted", nil
}

// IsBlockedEither: algum dos dois bloqueou o outro.
func (s *Service) IsBlockedEither(ctx context.Context, a string, b string) (bool, error) {
	aBlocksB, bBlocksA, err := s.repository.Blocks(ctx, a, b)
	if err != nil {
		return false, err
	}
	return aBlocksB || bBlocksA, nil
}

// CanDirectMessage é a regra da DM 1:1: ninguém bloqueado; amigos sempre;
// sem amizade, só quem divide um servidor e se o destinatário permite DM de
// membros de servidores.
func (s *Service) CanDirectMessage(ctx context.Context, fromID string, toID string) error {
	if toID == bot.UserID || fromID == bot.UserID {
		return ErrBotUser
	}
	blocked, err := s.IsBlockedEither(ctx, fromID, toID)
	if err != nil {
		return err
	}
	if blocked {
		return ErrBlocked
	}

	if friends, _ := s.AreFriends(ctx, fromID, toID); friends {
		return nil
	}

	if s.servers == nil {
		return ErrCannotMessage
	}
	to, err := s.userService.FindByID(ctx, toID)
	if err != nil {
		return ErrUserNotFound
	}
	if !to.AllowServerDMs {
		return ErrCannotMessage
	}
	shares, err := s.servers.SharesServer(ctx, fromID, toID)
	if err != nil || !shares {
		return ErrCannotMessage
	}
	return nil
}
