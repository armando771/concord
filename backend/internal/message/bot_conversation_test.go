package message

import (
	"context"
	"errors"
	"testing"

	"gin-quickstart/backend/internal/bot"
)

type botRooms struct{ ids []string }

func (r botRooms) ConversationParticipantIDs(context.Context, string) ([]string, error) {
	return r.ids, nil
}

func (botRooms) RevealConversation(context.Context, string) error { return nil }

// A DM com o Salinha Bot é só leitura: ninguém reage às mensagens dele. A
// checagem vem antes de buscar a mensagem (o repositório nem é usado).
func TestReactionInBotConversationIsRefused(t *testing.T) {
	s := MessageService(nil, nil, nil, botRooms{ids: []string{"u1", bot.SalinhaBotID}}, nil, nil)
	err := s.AddConversationReaction(context.Background(), "c1", "m1", "u1", "👍")
	if !errors.Is(err, ErrBotConversation) {
		t.Fatalf("esperava ErrBotConversation, veio %v", err)
	}
}

func TestBotConversationOnlyForBotDMs(t *testing.T) {
	s := MessageService(nil, nil, nil, botRooms{ids: []string{"u1", "u2"}}, nil, nil)
	if s.botConversation(context.Background(), "c1", "u1") {
		t.Fatal("DM entre pessoas não é só leitura")
	}
	s = MessageService(nil, nil, nil, botRooms{ids: []string{"u1", bot.SalinhaBotID}}, nil, nil)
	if s.botConversation(context.Background(), "c1", bot.SalinhaBotID) {
		t.Fatal("o próprio bot escreve na conversa dele")
	}
}
