package music

import (
	"context"
	"errors"
	"testing"
)

type fakeBoard struct {
	has     bool
	hasErr  error
	postErr error
	posted  []postedMsg
}

type postedMsg struct{ channelID, authorID, content, kind string }

func (f *fakeBoard) HasSystemMessage(_ context.Context, _, kind string) (bool, error) {
	if kind != CommandsKind {
		return false, errors.New("tipo errado")
	}
	return f.has, f.hasErr
}

func (f *fakeBoard) CreateAndPinSystemMessage(_ context.Context, channelID, authorID, content, kind string) error {
	if f.postErr != nil {
		return f.postErr
	}
	f.posted = append(f.posted, postedMsg{channelID, authorID, content, kind})
	return nil
}

func TestPinCommandsPostaEFixaUmaVez(t *testing.T) {
	board := &fakeBoard{}
	posted, err := PinCommands(context.Background(), board, "c1", "maestro")
	if err != nil || !posted {
		t.Fatalf("posted=%v err=%v, want true,nil", posted, err)
	}
	want := postedMsg{"c1", "maestro", TextCommands(), CommandsKind}
	if len(board.posted) != 1 || board.posted[0] != want {
		t.Fatalf("posted = %+v, want [%+v]", board.posted, want)
	}
}

func TestPinCommandsNaoRepeteSeJaExiste(t *testing.T) {
	board := &fakeBoard{has: true}
	posted, err := PinCommands(context.Background(), board, "c1", "maestro")
	if err != nil || posted || len(board.posted) != 0 {
		t.Fatalf("posted=%v err=%v n=%d, want false,nil,0", posted, err, len(board.posted))
	}
}

func TestPinCommandsPropagaErros(t *testing.T) {
	boom := errors.New("boom")
	if _, err := PinCommands(context.Background(), &fakeBoard{hasErr: boom}, "c1", "m"); !errors.Is(err, boom) {
		t.Errorf("erro da checagem = %v, want boom", err)
	}
	if _, err := PinCommands(context.Background(), &fakeBoard{postErr: boom}, "c1", "m"); !errors.Is(err, boom) {
		t.Errorf("erro do post = %v, want boom", err)
	}
}
