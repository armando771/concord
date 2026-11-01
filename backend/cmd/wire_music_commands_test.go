package main

import (
	"context"
	"errors"
	"testing"

	"gin-quickstart/backend/internal/bot"
	"gin-quickstart/backend/internal/channel"
	"gin-quickstart/backend/internal/music"
)

type fakeLister struct {
	channels []channel.Channel
	err      error
}

func (f fakeLister) MaestroChannels(context.Context) ([]channel.Channel, error) {
	return f.channels, f.err
}

// fakeBoard guarda as mensagens fixadas por canal, como o banco faria.
type fakeBoard struct {
	pinned map[string][]string
}

func newFakeBoard() *fakeBoard { return &fakeBoard{pinned: map[string][]string{}} }

func (f *fakeBoard) HasSystemMessage(_ context.Context, channelID, kind string) (bool, error) {
	return len(f.pinned[channelID]) > 0 && kind == music.CommandsKind, nil
}

func (f *fakeBoard) CreateAndPinSystemMessage(_ context.Context, channelID, authorID, content, _ string) error {
	if authorID != bot.UserID {
		return errors.New("autor deveria ser o Maestro")
	}
	f.pinned[channelID] = append(f.pinned[channelID], content)
	return nil
}

func TestBackfillMusicCommandsFixaSoOndeOMaestroEsta(t *testing.T) {
	lister := fakeLister{channels: []channel.Channel{
		{ID: "c1", ServerID: "s1"},
		{ID: "c2", ServerID: "s2"},
	}}
	board := newFakeBoard()
	isMember := func(_ context.Context, serverID, userID string) bool {
		return serverID == "s1" && userID == bot.UserID
	}

	backfillMusicCommands(context.Background(), lister, board, isMember)
	backfillMusicCommands(context.Background(), lister, board, isMember) // segundo boot

	if got := board.pinned["c1"]; len(got) != 1 || got[0] != music.TextCommands() {
		t.Fatalf("c1 = %q, want a lista de comandos uma única vez", got)
	}
	if len(board.pinned["c2"]) != 0 {
		t.Fatalf("c2 (sem Maestro) = %q, want nada", board.pinned["c2"])
	}
}

func TestBackfillMusicCommandsErroDeListagemNaoPosta(t *testing.T) {
	board := newFakeBoard()
	backfillMusicCommands(context.Background(), fakeLister{err: errors.New("boom")}, board,
		func(context.Context, string, string) bool { return true })
	if len(board.pinned) != 0 {
		t.Fatalf("postou mesmo com erro: %v", board.pinned)
	}
}

func TestPinMusicCommandsNaCriacaoDoServidor(t *testing.T) {
	board := newFakeBoard()
	pinMusicCommands(context.Background(), board, "novo")
	if got := board.pinned["novo"]; len(got) != 1 || got[0] != music.TextCommands() {
		t.Fatalf("novo = %q, want a lista de comandos", got)
	}
}
