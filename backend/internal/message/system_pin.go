package message

import "context"

// HasSystemMessage diz se o canal já tem alguma mensagem de sistema desse tipo
// (fixada ou não). Serve para postar uma vez só, mesmo que alguém desafixe.
func (s *Service) HasSystemMessage(ctx context.Context, channelID, kind string) (bool, error) {
	return s.repository.ChannelHasSystemKind(ctx, channelID, kind)
}

// CreateAndPinSystemMessage grava uma mensagem do servidor no canal e a fixa em
// nome do próprio autor (o bot não passa pela checagem de MANAGE_MESSAGES).
func (s *Service) CreateAndPinSystemMessage(ctx context.Context, channelID, authorID, content, kind string) error {
	msg, err := s.CreateSystemChannelMessage(ctx, channelID, authorID, content, kind)
	if err != nil {
		return err
	}
	pinned, err := s.repository.PinMessage(ctx, channelID, msg.ID, authorID)
	if err != nil {
		return err
	}
	s.publishPin(ctx, channelID, pinned)
	return nil
}

// publishPin avisa o servidor que a mensagem foi fixada.
func (s *Service) publishPin(ctx context.Context, channelID string, pinned *PinnedMessage) {
	if s.publisher == nil {
		return
	}
	serverID := ""
	if s.channelResolver != nil {
		serverID, _ = s.channelResolver.ChannelServerID(ctx, channelID)
	}
	s.publisher.PublishMessagePin(PinEvent{ChannelID: channelID, ServerID: serverID, Message: *pinned})
}
