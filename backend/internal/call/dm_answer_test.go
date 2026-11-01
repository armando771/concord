package call

import (
	"context"
	"errors"
	"testing"
)

func answerRig() (*Service, *fakePublisher) {
	pub := &fakePublisher{}
	s := ringingDM(pub)
	s.lookupUser = func(_ context.Context, id string) (UserInfo, error) {
		return UserInfo{ID: id, Username: id, DisplayName: "Nome " + id}, nil
	}
	return s, pub
}

func TestAccept(t *testing.T) {
	ctx := context.Background()

	t.Run("o chamado atende: a chamada fica ativa e todos recebem call:accept", func(t *testing.T) {
		s, pub := answerRig()
		if err := s.Accept(ctx, "call-1", "bia"); err != nil {
			t.Fatalf("Accept: %v", err)
		}
		ac := s.calls["call-1"]
		if ac.info.Status != StatusActive || ac.participants["bia"] == nil || s.busy["bia"] != "call-1" {
			t.Fatalf("status=%s participantes=%v", ac.info.Status, ac.participants)
		}
		if len(pub.eventsOf("call:accept")) != 1 {
			t.Fatal("esperava um call:accept")
		}
	})

	t.Run("chamada inexistente ou encerrada", func(t *testing.T) {
		s, _ := answerRig()
		if err := s.Accept(ctx, "nao-existe", "bia"); !errors.Is(err, ErrNotFound) {
			t.Fatalf("err=%v", err)
		}
		s.calls["call-1"].info.Status = StatusEnded
		if err := s.Accept(ctx, "call-1", "bia"); !errors.Is(err, ErrNotFound) {
			t.Fatalf("err=%v", err)
		}
	})

	t.Run("só o chamado atende a DM", func(t *testing.T) {
		s, _ := answerRig()
		if err := s.Accept(ctx, "call-1", "intruso"); !errors.Is(err, ErrNotAllowed) {
			t.Fatalf("err=%v", err)
		}
	})

	t.Run("quem já está na chamada não entra de novo", func(t *testing.T) {
		s, pub := answerRig()
		if err := s.Accept(ctx, "call-1", "ana"); err == nil || errors.Is(err, ErrNotFound) {
			// ana é quem ligou: não é o chamado
			if !errors.Is(err, ErrNotAllowed) {
				t.Fatalf("err=%v", err)
			}
		}
		s.calls["call-1"].inviteeID = "ana"
		if err := s.Accept(ctx, "call-1", "ana"); err != nil {
			t.Fatalf("já participante deveria ser no-op: %v", err)
		}
		if len(pub.eventsOf("call:accept")) != 0 {
			t.Fatal("não deveria republicar")
		}
	})

	t.Run("chamado já em outra chamada: ocupado", func(t *testing.T) {
		s, _ := answerRig()
		s.busy["bia"] = "outra"
		if err := s.Accept(ctx, "call-1", "bia"); !errors.Is(err, ErrBusy) {
			t.Fatalf("err=%v", err)
		}
	})

	t.Run("falha ao buscar o usuário", func(t *testing.T) {
		s, _ := answerRig()
		s.lookupUser = func(context.Context, string) (UserInfo, error) { return UserInfo{}, errors.New("banco") }
		if err := s.Accept(ctx, "call-1", "bia"); err == nil {
			t.Fatal("esperava erro")
		}
	})
}

func TestDecline(t *testing.T) {
	ctx := context.Background()

	t.Run("recusar avisa quem ligou e encerra a chamada", func(t *testing.T) {
		s, pub := answerRig()
		if err := s.Decline(ctx, "call-1", "bia"); err != nil {
			t.Fatalf("Decline: %v", err)
		}
		if _, ok := s.calls["call-1"]; ok {
			t.Fatal("a chamada deveria ter terminado")
		}
		declined := pub.eventsOf("call:decline")
		if len(declined) != 1 || declined[0].target != "user:ana" {
			t.Fatalf("call:decline = %+v", declined)
		}
		if len(pub.eventsOf("call:ended")) == 0 {
			t.Fatal("esperava call:ended")
		}
	})

	t.Run("inexistente, encerrada ou de quem não é o chamado", func(t *testing.T) {
		s, _ := answerRig()
		if err := s.Decline(ctx, "nao-existe", "bia"); !errors.Is(err, ErrNotFound) {
			t.Fatalf("err=%v", err)
		}
		if err := s.Decline(ctx, "call-1", "intruso"); !errors.Is(err, ErrNotAllowed) {
			t.Fatalf("err=%v", err)
		}
	})

	t.Run("falha ao buscar o usuário", func(t *testing.T) {
		s, _ := answerRig()
		s.lookupUser = func(context.Context, string) (UserInfo, error) { return UserInfo{}, errors.New("banco") }
		if err := s.Decline(ctx, "call-1", "bia"); err == nil {
			t.Fatal("esperava erro")
		}
	})
}
