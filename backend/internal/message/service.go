package message

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

var (
	ErrContentRequired = errors.New("content is required")
	ErrMessageNotFound = errors.New("message not found")
	ErrNotAuthor       = errors.New("only the author can delete this message")
)

type EventPublisher interface {
	PublishMessageCreate(event CreateEvent)
	PublishMessageDelete(event DeleteEvent)
	PublishPollUpdate(event PollUpdateEvent)
}

type ChannelResolver interface {
	ChannelServerID(ctx context.Context, channelID string) (string, error)
}

type ConversationResolver interface {
	ConversationParticipantIDs(ctx context.Context, conversationID string) ([]string, error)
}

type Service struct {
	repository      *Repository
	publisher       EventPublisher
	channelResolver ChannelResolver
	convResolver    ConversationResolver
}

func MessageService(repository *Repository, publisher EventPublisher, channelResolver ChannelResolver, convResolver ConversationResolver) *Service {
	return &Service{
		repository:      repository,
		publisher:       publisher,
		channelResolver: channelResolver,
		convResolver:    convResolver,
	}
}

func (s *Service) CreateChannelMessage(ctx context.Context, channelID string, authorID string, content string) (*Message, error) {
	msg, err := s.create(ctx, channelID, "", authorID, content)
	if err != nil {
		return nil, err
	}

	serverID := ""
	if s.channelResolver != nil {
		serverID, _ = s.channelResolver.ChannelServerID(ctx, channelID)
	}

	s.publisher.PublishMessageCreate(CreateEvent{
		ChannelID: msg.ChannelID,
		ServerID:  serverID,
		Message:   *msg,
	})

	return msg, nil
}

func (s *Service) CreateConversationMessage(ctx context.Context, conversationID string, authorID string, content string) (*Message, error) {
	msg, err := s.create(ctx, "", conversationID, authorID, content)
	if err != nil {
		return nil, err
	}

	var userIDs []string
	if s.convResolver != nil {
		userIDs, _ = s.convResolver.ConversationParticipantIDs(ctx, conversationID)
	}

	s.publisher.PublishMessageCreate(CreateEvent{
		ConversationID: msg.ConversationID,
		UserIDs:        userIDs,
		Message:        *msg,
	})

	return msg, nil
}

func (s *Service) create(ctx context.Context, channelID string, conversationID string, authorID string, content string) (*Message, error) {
	if content == "" {
		return nil, ErrContentRequired
	}

	msg := &Message{
		ID:             uuid.New().String(),
		AuthorID:       authorID,
		ChannelID:      &channelID,
		ConversationID: &conversationID,
		Content:        content,
	}

	if channelID == "" {
		msg.ChannelID = nil
	}
	if conversationID == "" {
		msg.ConversationID = nil
	}

	if err := s.repository.Create(ctx, msg); err != nil {
		return nil, err
	}

	full, err := s.repository.FindByID(ctx, msg.ID)
	if err != nil {
		return nil, err
	}

	return full, nil
}

func (s *Service) ListChannelMessages(ctx context.Context, channelID string, viewerID string, limit int, before string) ([]Message, error) {
	messages, err := s.repository.ListByChannel(ctx, channelID, limit, before)
	if err != nil {
		return nil, err
	}
	if err := s.repository.AttachPolls(ctx, messages, viewerID); err != nil {
		return nil, err
	}
	return messages, nil
}

func (s *Service) ListConversationMessages(ctx context.Context, conversationID string, viewerID string, limit int, before string) ([]Message, error) {
	messages, err := s.repository.ListByConversation(ctx, conversationID, limit, before)
	if err != nil {
		return nil, err
	}
	if err := s.repository.AttachPolls(ctx, messages, viewerID); err != nil {
		return nil, err
	}
	return messages, nil
}

func (s *Service) DeleteChannelMessage(ctx context.Context, channelID string, messageID string, userID string) error {
	msg, err := s.repository.FindByID(ctx, messageID)
	if err != nil {
		return ErrMessageNotFound
	}

	if msg.ChannelID == nil || *msg.ChannelID != channelID {
		return ErrMessageNotFound
	}

	if msg.AuthorID != userID {
		return ErrNotAuthor
	}

	if err := s.repository.Delete(ctx, messageID); err != nil {
		return err
	}

	serverID := ""
	if s.channelResolver != nil {
		serverID, _ = s.channelResolver.ChannelServerID(ctx, channelID)
	}

	s.publisher.PublishMessageDelete(DeleteEvent{
		ChannelID: msg.ChannelID,
		ServerID:  serverID,
		MessageID: messageID,
	})

	return nil
}

func (s *Service) DeleteConversationMessage(ctx context.Context, conversationID string, messageID string, userID string) error {
	msg, err := s.repository.FindByID(ctx, messageID)
	if err != nil {
		return ErrMessageNotFound
	}

	if msg.ConversationID == nil || *msg.ConversationID != conversationID {
		return ErrMessageNotFound
	}

	if msg.AuthorID != userID {
		return ErrNotAuthor
	}

	if err := s.repository.Delete(ctx, messageID); err != nil {
		return err
	}

	var userIDs []string
	if s.convResolver != nil {
		userIDs, _ = s.convResolver.ConversationParticipantIDs(ctx, conversationID)
	}

	s.publisher.PublishMessageDelete(DeleteEvent{
		ConversationID: msg.ConversationID,
		UserIDs:        userIDs,
		MessageID:      messageID,
	})

	return nil
}
