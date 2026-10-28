package music

import (
	"context"
	"fmt"
)

// CommandsBoard é o que o Maestro usa do chat para deixar a lista de comandos
// fixada no canal #musica.
type CommandsBoard interface {
	HasSystemMessage(ctx context.Context, channelID, kind string) (bool, error)
	CreateAndPinSystemMessage(ctx context.Context, channelID, authorID, content, kind string) error
}

// PinCommands posta no canal a lista de comandos do Maestro e a fixa. Só faz
// uma vez por canal: se a mensagem já existe (mesmo desafixada), não repete.
// Devolve true se postou agora.
func PinCommands(ctx context.Context, board CommandsBoard, channelID, botID string) (bool, error) {
	exists, err := board.HasSystemMessage(ctx, channelID, CommandsKind)
	if err != nil {
		return false, fmt.Errorf("checar lista de comandos do canal %s: %w", channelID, err)
	}
	if exists {
		return false, nil
	}
	if err := board.CreateAndPinSystemMessage(ctx, channelID, botID, TextCommands(), CommandsKind); err != nil {
		return false, fmt.Errorf("fixar lista de comandos no canal %s: %w", channelID, err)
	}
	return true, nil
}
