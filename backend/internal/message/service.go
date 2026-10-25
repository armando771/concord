package message

import (
	"context"
	"errors"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"
)

var (
	ErrContentRequired = errors.New("content is required")
	ErrMessageNotFound = errors.New("message not found")
	ErrNotAuthor       = errors.New("only the author can delete this message")
	ErrInvalidReply    = errors.New("invalid reply target")
	ErrInvalidEmoji    = errors.New("invalid emoji reaction")
)

type EventPublisher interface {
	PublishMessageCreate(event CreateEvent)
	PublishMessageDelete(event DeleteEvent)
	PublishPollUpdate(event PollUpdateEvent)
	PublishReactionAdd(event ReactionEvent)
	PublishReactionRemove(event ReactionEvent)
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

func ValidateEmoji(emoji string) error {
	if emoji == "" || len(emoji) > 32 || !utf8.ValidString(emoji) {
		return ErrInvalidEmoji
	}
	for _, r := range emoji {
		if unicode.IsSpace(r) || unicode.IsControl(r) {
			return ErrInvalidEmoji
		}
	}
	return nil
}

func SameRoomTarget(target *Message, channelID string, conversationID string) bool {
	if target == nil {
		return false
	}
	if channelID != "" {
		return target.ChannelID != nil && *target.ChannelID == channelID && target.ConversationID == nil
	}
	if conversationID != "" {
		return target.ConversationID != nil && *target.ConversationID == conversationID && target.ChannelID == nil
	}
	return false
}

func (s *Service) CreateChannelMessage(ctx context.Context, channelID string, authorID string, content string, replyToID *string) (*Message, error) {
	msg, err := s.create(ctx, channelID, "", authorID, content, replyToID)
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

func (s *Service) CreateConversationMessage(ctx context.Context, conversationID string, authorID string, content string, replyToID *string) (*Message, error) {
	msg, err := s.create(ctx, "", conversationID, authorID, content, replyToID)
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

func (s *Service) create(ctx context.Context, channelID string, conversationID string, authorID string, content string, replyToID *string) (*Message, error) {
	if content == "" {
		return nil, ErrContentRequired
	}

	var normalizedReplyID *string
	if replyToID != nil {
		trimmed := strings.TrimSpace(*replyToID)
		if trimmed != "" {
			target, err := s.repository.FindByID(ctx, trimmed)
			if err != nil || !SameRoomTarget(target, channelID, conversationID) {
				return nil, ErrInvalidReply
			}
			normalizedReplyID = &trimmed
		}
	}

	msg := &Message{
		ID:             uuid.New().String(),
		AuthorID:       authorID,
		ChannelID:      &channelID,
		ConversationID: &conversationID,
		ReplyToID:      normalizedReplyID,
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

func (s *Service) AddChannelReaction(ctx context.Context, channelID string, messageID string, userID string, emoji string) error {
	if err := ValidateEmoji(emoji); err != nil {
		return err
	}

	msg, err := s.repository.FindByID(ctx, messageID)
	if err != nil || !SameRoomTarget(msg, channelID, "") {
		return ErrMessageNotFound
	}

	added, err := s.repository.AddReaction(ctx, messageID, userID, emoji)
	if err != nil {
		return err
	}
	if added {
		s.publisher.PublishReactionAdd(ReactionEvent{
			ChannelID: msg.ChannelID,
			MessageID: msg.ID,
			UserID:    userID,
			Emoji:     emoji,
		})
	}
	return nil
}

func (s *Service) RemoveChannelReaction(ctx context.Context, channelID string, messageID string, userID string, emoji string) error {
	if err := ValidateEmoji(emoji); err != nil {
		return err
	}

	msg, err := s.repository.FindByID(ctx, messageID)
	if err != nil || !SameRoomTarget(msg, channelID, "") {
		return ErrMessageNotFound
	}

	removed, err := s.repository.RemoveReaction(ctx, messageID, userID, emoji)
	if err != nil {
		return err
	}
	if removed {
		s.publisher.PublishReactionRemove(ReactionEvent{
			ChannelID: msg.ChannelID,
			MessageID: msg.ID,
			UserID:    userID,
			Emoji:     emoji,
		})
	}
	return nil
}

func (s *Service) AddConversationReaction(ctx context.Context, conversationID string, messageID string, userID string, emoji string) error {
	if err := ValidateEmoji(emoji); err != nil {
		return err
	}

	msg, err := s.repository.FindByID(ctx, messageID)
	if err != nil || !SameRoomTarget(msg, "", conversationID) {
		return ErrMessageNotFound
	}

	added, err := s.repository.AddReaction(ctx, messageID, userID, emoji)
	if err != nil {
		return err
	}
	if added {
		s.publisher.PublishReactionAdd(ReactionEvent{
			ConversationID: msg.ConversationID,
			MessageID:      msg.ID,
			UserID:         userID,
			Emoji:          emoji,
		})
	}
	return nil
}

func (s *Service) RemoveConversationReaction(ctx context.Context, conversationID string, messageID string, userID string, emoji string) error {
	if err := ValidateEmoji(emoji); err != nil {
		return err
	}

	msg, err := s.repository.FindByID(ctx, messageID)
	if err != nil || !SameRoomTarget(msg, "", conversationID) {
		return ErrMessageNotFound
	}

	removed, err := s.repository.RemoveReaction(ctx, messageID, userID, emoji)
	if err != nil {
		return err
	}
	if removed {
		s.publisher.PublishReactionRemove(ReactionEvent{
			ConversationID: msg.ConversationID,
			MessageID:      msg.ID,
			UserID:         userID,
			Emoji:          emoji,
		})
	}
	return nil
}
