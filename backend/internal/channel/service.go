package channel

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

var (
	ErrNameRequired    = errors.New("name is required")
	ErrChannelNotFound = errors.New("channel not found")
)

type EventPublisher interface {
	PublishChannelCreate(event CreateEvent)
	PublishChannelUpdate(event CreateEvent)
	PublishChannelDelete(event DeleteEvent)
	PublishChannelReorder(event ReorderEvent)
}

// store é o que o Service usa do Repository (nos testes, um fake em memória).
type store interface {
	Create(ctx context.Context, ch *Channel) error
	FindByID(ctx context.Context, id string) (*Channel, error)
	Update(ctx context.Context, id string, name string) error
	Delete(ctx context.Context, id string) error
	ListByServerID(ctx context.Context, serverID string) ([]Channel, error)
	IsMember(ctx context.Context, serverID string, userID string) (bool, error)
	IsAdminOrOwner(ctx context.Context, serverID string, userID string) (bool, error)
	Reorder(ctx context.Context, serverID string, chType string, ids []string) error
}

type Service struct {
	repository store
	publisher  EventPublisher
}

func ChannelService(repository *Repository, publisher EventPublisher) *Service {
	return newService(repository, publisher)
}

func newService(repository store, publisher EventPublisher) *Service {
	return &Service{
		repository: repository,
		publisher:  publisher,
	}
}

func (s *Service) Create(ctx context.Context, ch *Channel) error {
	if ch.Name == "" {
		return ErrNameRequired
	}

	if ch.Type == "" {
		ch.Type = TypeText
	}

	ch.ID = uuid.New().String()

	if err := s.repository.Create(ctx, ch); err != nil {
		return err
	}

	if s.publisher != nil {
		s.publisher.PublishChannelCreate(CreateEvent{
			ServerID: ch.ServerID,
			Channel:  *ch,
		})
	}

	return nil
}

func (s *Service) FindByID(ctx context.Context, id string) (*Channel, error) {
	return s.repository.FindByID(ctx, id)
}

func (s *Service) Update(ctx context.Context, id string, name string) (*Channel, error) {
	if name == "" {
		return nil, ErrNameRequired
	}

	ch, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return nil, ErrChannelNotFound
	}

	if err := s.repository.Update(ctx, id, name); err != nil {
		return nil, err
	}

	updated, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if s.publisher != nil {
		s.publisher.PublishChannelUpdate(CreateEvent{
			ServerID: ch.ServerID,
			Channel:  *updated,
		})
	}

	return updated, nil
}

func (s *Service) Delete(ctx context.Context, id string) error {
	ch, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return ErrChannelNotFound
	}

	if err := s.repository.Delete(ctx, id); err != nil {
		return err
	}

	if s.publisher != nil {
		s.publisher.PublishChannelDelete(DeleteEvent{
			ServerID:  ch.ServerID,
			ChannelID: id,
		})
	}

	return nil
}

// Reorder muda a ordem dos canais de um tipo (texto ou voz) do servidor; ids
// tem que ser exatamente os canais daquela seção. Avisa a sala do servidor.
func (s *Service) Reorder(ctx context.Context, serverID string, chType string, ids []string) error {
	if chType != TypeText && chType != TypeVoice {
		return ErrInvalidType
	}
	if ids == nil {
		ids = []string{}
	}

	if err := s.repository.Reorder(ctx, serverID, chType, ids); err != nil {
		return err
	}

	if s.publisher != nil {
		s.publisher.PublishChannelReorder(ReorderEvent{
			ServerID:   serverID,
			Type:       chType,
			ChannelIDs: ids,
		})
	}

	return nil
}

func (s *Service) ListByServerID(ctx context.Context, serverID string) ([]Channel, error) {
	return s.repository.ListByServerID(ctx, serverID)
}

func (s *Service) IsMember(ctx context.Context, serverID string, userID string) (bool, error) {
	return s.repository.IsMember(ctx, serverID, userID)
}

func (s *Service) IsAdminOrOwner(ctx context.Context, serverID string, userID string) (bool, error) {
	return s.repository.IsAdminOrOwner(ctx, serverID, userID)
}