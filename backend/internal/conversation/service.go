package conversation

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

var (
	ErrNotFound       = errors.New("conversation not found")
	ErrNotParticipant = errors.New("you are not a participant of this conversation")
	ErrNotGroup       = errors.New("this conversation is not a group")
	ErrIsGroup        = errors.New("not allowed in a group conversation")
	ErrGroupFull      = errors.New("group conversations are limited to 10 members")
	ErrGroupEmpty     = errors.New("pick at least one friend")
	ErrNotOwner       = errors.New("only the group owner can do this")
	ErrOnlyFriends    = errors.New("you can only add friends to a group")
	ErrInvalidName    = errors.New("invalid group name")
)

// Eventos para os participantes (sala user:<id>); o app recarrega a lista.
const (
	EventCreate = "conversation:create"
	EventUpdate = "conversation:update"
	EventRemove = "conversation:remove"
	EventRead   = "conversation:read"
)

type EventPublisher interface {
	PublishConversationEvent(eventType string, conversationID string, userIDs []string)
}

// FriendChecker é a parte de amizades que as conversas usam.
type FriendChecker interface {
	AreFriends(ctx context.Context, a string, b string) (bool, error)
	IsBlockedEither(ctx context.Context, a string, b string) (bool, error)
	CanDirectMessage(ctx context.Context, fromID string, toID string) error
}

// store é o que o Service usa do Repository (trocável nos testes).
type store interface {
	CreateDM(ctx context.Context, conv *Conversation, openerID string) error
	CreateGroup(ctx context.Context, conv *Conversation, memberIDs []string) error
	FindByPair(ctx context.Context, userAID string, userBID string) (*Conversation, error)
	FindByID(ctx context.Context, id string) (*Conversation, error)
	IsMember(ctx context.Context, conversationID string, userID string) (bool, error)
	ConversationParticipantIDs(ctx context.Context, conversationID string) ([]string, error)
	Members(ctx context.Context, conversationID string) ([]OtherUser, error)
	SetHidden(ctx context.Context, conversationID string, userID string, hidden bool) error
	MarkRead(ctx context.Context, conversationID string, userID string, messageID string) error
	Rename(ctx context.Context, conversationID string, name string) error
	SetIcon(ctx context.Context, conversationID string, url *string) (*string, error)
	AddMembers(ctx context.Context, conversationID string, userIDs []string) error
	RemoveMember(ctx context.Context, conversationID string, userID string) error
	SetOwner(ctx context.Context, conversationID string, ownerID string) error
	Delete(ctx context.Context, conversationID string) error
	ListByUserID(ctx context.Context, userID string) ([]Summary, error)
}

type Service struct {
	repository store
	friends    FriendChecker
	publisher  EventPublisher
}

func ConversationService(repository *Repository) *Service {
	return &Service{
		repository: repository,
	}
}

// SetDependencies liga amizades (quem pode entrar/mandar DM) e os eventos.
func (s *Service) SetDependencies(friends FriendChecker, publisher EventPublisher) {
	s.friends = friends
	s.publisher = publisher
}

func (s *Service) publish(eventType string, conversationID string, userIDs []string) {
	if s.publisher != nil && len(userIDs) > 0 {
		s.publisher.PublishConversationEvent(eventType, conversationID, userIDs)
	}
}

// GetOrCreateWith abre a DM 1:1 com outra pessoa. Uma DM que já existe abre
// sempre (o histórico continua legível); criar uma nova segue a regra de
// quem pode mandar DM.
func (s *Service) GetOrCreateWith(ctx context.Context, userID string, otherUserID string) (*Conversation, error) {
	userA, userB := userID, otherUserID
	if userA > userB {
		userA, userB = userB, userA
	}

	existing, err := s.repository.FindByPair(ctx, userA, userB)
	if err == nil {
		if err := s.repository.SetHidden(ctx, existing.ID, userID, false); err != nil {
			return nil, err
		}
		return existing, nil
	}

	if s.friends != nil {
		if err := s.friends.CanDirectMessage(ctx, userID, otherUserID); err != nil {
			return nil, err
		}
	}

	conv := &Conversation{
		ID:      uuid.New().String(),
		Type:    TypeDM,
		UserAID: userA,
		UserBID: userB,
	}

	if err := s.repository.CreateDM(ctx, conv, userID); err != nil {
		// Os dois abriram ao mesmo tempo: usa a que ganhou.
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return s.repository.FindByPair(ctx, userA, userB)
		}
		return nil, err
	}

	return conv, nil
}

// GetOrCreateBotDM abre (ou reabre) a DM entre um bot e userID sem as regras de
// DM entre pessoas: é o servidor avisando (Salinha Bot). A conversa aparece
// para a pessoa mesmo que ela a tenha fechado.
func (s *Service) GetOrCreateBotDM(ctx context.Context, botID string, userID string) (*Conversation, error) {
	userA, userB := botID, userID
	if userA > userB {
		userA, userB = userB, userA
	}
	if existing, err := s.repository.FindByPair(ctx, userA, userB); err == nil {
		return existing, nil
	}
	conv := &Conversation{ID: uuid.New().String(), Type: TypeDM, UserAID: userA, UserBID: userB}
	if err := s.repository.CreateDM(ctx, conv, botID); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return s.repository.FindByPair(ctx, userA, userB)
		}
		return nil, err
	}
	return conv, nil
}

// CreateGroup cria uma DM em grupo com amigos. Com um amigo só, abre a DM
// 1:1 (como o botão "Criar DM" do Discord).
func (s *Service) CreateGroup(ctx context.Context, ownerID string, userIDs []string) (*Conversation, error) {
	others := uniqueOthers(userIDs, ownerID)
	if len(others) == 0 {
		return nil, ErrGroupEmpty
	}
	if len(others) == 1 {
		return s.GetOrCreateWith(ctx, ownerID, others[0])
	}
	if len(others)+1 > MaxGroupMembers {
		return nil, ErrGroupFull
	}
	if err := s.checkFriends(ctx, ownerID, others); err != nil {
		return nil, err
	}

	owner := ownerID
	conv := &Conversation{
		ID:      uuid.New().String(),
		Type:    TypeGroup,
		OwnerID: &owner,
	}
	members := append([]string{ownerID}, others...)
	if err := s.repository.CreateGroup(ctx, conv, members); err != nil {
		return nil, err
	}

	s.publish(EventCreate, conv.ID, members)
	return conv, nil
}

// checkFriends: só amigos (sem bloqueio) entram no grupo.
func (s *Service) checkFriends(ctx context.Context, userID string, others []string) error {
	if s.friends == nil {
		return nil
	}
	for _, id := range others {
		friends, err := s.friends.AreFriends(ctx, userID, id)
		if err != nil {
			return err
		}
		if !friends {
			return ErrOnlyFriends
		}
		if blocked, err := s.friends.IsBlockedEither(ctx, userID, id); err != nil || blocked {
			return ErrOnlyFriends
		}
	}
	return nil
}

func uniqueOthers(ids []string, self string) []string {
	seen := map[string]bool{self: true}
	out := []string{}
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		out = append(out, id)
	}
	return out
}

// group confere que é um grupo e que userID participa.
func (s *Service) group(ctx context.Context, conversationID string, userID string) (*Conversation, error) {
	conv, err := s.repository.FindByID(ctx, conversationID)
	if err != nil {
		return nil, ErrNotFound
	}
	if !conv.IsGroup() {
		return nil, ErrNotGroup
	}
	if ok, err := s.repository.IsMember(ctx, conversationID, userID); err != nil || !ok {
		return nil, ErrNotParticipant
	}
	return conv, nil
}

// Rename muda o nome do grupo (qualquer participante, como no Discord).
func (s *Service) Rename(ctx context.Context, userID string, conversationID string, name string) error {
	if _, err := s.group(ctx, conversationID, userID); err != nil {
		return err
	}
	name = strings.TrimSpace(name)
	if len([]rune(name)) > MaxGroupName {
		return ErrInvalidName
	}
	if err := s.repository.Rename(ctx, conversationID, name); err != nil {
		return err
	}
	s.publishToMembers(ctx, EventUpdate, conversationID)
	return nil
}

// SetIcon troca o ícone do grupo e devolve o antigo para apagar o arquivo.
func (s *Service) SetIcon(ctx context.Context, userID string, conversationID string, url *string) (*string, error) {
	if _, err := s.group(ctx, conversationID, userID); err != nil {
		return nil, err
	}
	old, err := s.repository.SetIcon(ctx, conversationID, url)
	if err != nil {
		return nil, err
	}
	s.publishToMembers(ctx, EventUpdate, conversationID)
	return old, nil
}

// AddMembers põe amigos de quem adiciona no grupo.
func (s *Service) AddMembers(ctx context.Context, userID string, conversationID string, userIDs []string) error {
	if _, err := s.group(ctx, conversationID, userID); err != nil {
		return err
	}
	current, err := s.repository.ConversationParticipantIDs(ctx, conversationID)
	if err != nil {
		return err
	}
	inGroup := map[string]bool{}
	for _, id := range current {
		inGroup[id] = true
	}
	added := []string{}
	for _, id := range uniqueOthers(userIDs, userID) {
		if !inGroup[id] {
			added = append(added, id)
		}
	}
	if len(added) == 0 {
		return nil
	}
	if len(current)+len(added) > MaxGroupMembers {
		return ErrGroupFull
	}
	if err := s.checkFriends(ctx, userID, added); err != nil {
		return err
	}
	if err := s.repository.AddMembers(ctx, conversationID, added); err != nil {
		return err
	}
	s.publish(EventUpdate, conversationID, current)
	s.publish(EventCreate, conversationID, added)
	return nil
}

// RemoveMember tira alguém do grupo: a própria pessoa sai; tirar outra só o
// dono. Se o dono sai, o mais antigo vira dono; grupo vazio é apagado.
func (s *Service) RemoveMember(ctx context.Context, actorID string, conversationID string, targetID string) error {
	conv, err := s.group(ctx, conversationID, actorID)
	if err != nil {
		return err
	}
	isOwner := conv.OwnerID != nil && *conv.OwnerID == actorID
	if targetID != actorID {
		if !isOwner {
			return ErrNotOwner
		}
		if ok, err := s.repository.IsMember(ctx, conversationID, targetID); err != nil || !ok {
			return ErrNotParticipant
		}
	}

	if err := s.repository.RemoveMember(ctx, conversationID, targetID); err != nil {
		return err
	}
	s.publish(EventRemove, conversationID, []string{targetID})

	remaining, err := s.repository.ConversationParticipantIDs(ctx, conversationID)
	if err != nil {
		return err
	}
	if len(remaining) == 0 {
		return s.repository.Delete(ctx, conversationID)
	}
	if conv.OwnerID == nil || *conv.OwnerID == targetID {
		if err := s.repository.SetOwner(ctx, conversationID, remaining[0]); err != nil {
			return err
		}
	}
	s.publish(EventUpdate, conversationID, remaining)
	return nil
}

// Hide fecha a DM 1:1 para quem pediu (volta com mensagem nova). Grupo não
// fecha: sai.
func (s *Service) Hide(ctx context.Context, userID string, conversationID string) error {
	conv, err := s.repository.FindByID(ctx, conversationID)
	if err != nil {
		return ErrNotFound
	}
	if conv.IsGroup() {
		return ErrIsGroup
	}
	if ok, err := s.repository.IsMember(ctx, conversationID, userID); err != nil || !ok {
		return ErrNotParticipant
	}
	if err := s.repository.SetHidden(ctx, conversationID, userID, true); err != nil {
		return err
	}
	s.publish(EventRemove, conversationID, []string{userID})
	return nil
}

// MarkRead marca como lido (até messageID, ou tudo) e avisa os outros
// dispositivos da pessoa.
func (s *Service) MarkRead(ctx context.Context, userID string, conversationID string, messageID string) error {
	if ok, err := s.repository.IsMember(ctx, conversationID, userID); err != nil || !ok {
		return ErrNotParticipant
	}
	if err := s.repository.MarkRead(ctx, conversationID, userID, messageID); err != nil {
		return err
	}
	s.publish(EventRead, conversationID, []string{userID})
	return nil
}

func (s *Service) publishToMembers(ctx context.Context, eventType string, conversationID string) {
	if ids, err := s.repository.ConversationParticipantIDs(ctx, conversationID); err == nil {
		s.publish(eventType, conversationID, ids)
	}
}

func (s *Service) FindByID(ctx context.Context, id string) (*Conversation, error) {
	conv, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	return conv, nil
}

// Detail traz a conversa com os participantes.
func (s *Service) Detail(ctx context.Context, id string) (*Detail, error) {
	conv, err := s.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	members, err := s.repository.Members(ctx, id)
	if err != nil {
		return nil, err
	}
	return &Detail{Conversation: *conv, Members: members}, nil
}

func (s *Service) IsParticipant(ctx context.Context, id string, userID string) (bool, error) {
	return s.repository.IsMember(ctx, id, userID)
}

// ParticipantIDs: todos os participantes da conversa.
func (s *Service) ParticipantIDs(ctx context.Context, id string) ([]string, error) {
	return s.repository.ConversationParticipantIDs(ctx, id)
}

func (s *Service) ListByUserID(ctx context.Context, userID string) ([]Summary, error) {
	return s.repository.ListByUserID(ctx, userID)
}
