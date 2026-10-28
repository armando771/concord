package channel

import (
	"context"
	"testing"
)

func TestMaestroChannelIsCalledMusica(t *testing.T) {
	if SystemChannelName != "musica" {
		t.Fatalf("SystemChannelName = %q, want musica", SystemChannelName)
	}
	svc := newService(newSystemStore(), nil)
	sys, err := svc.CreateSystem(context.Background(), "s2", "dono")
	if err != nil {
		t.Fatal(err)
	}
	if sys.Name != "musica" {
		t.Fatalf("canal criado = %q, want musica", sys.Name)
	}
}

func TestCreateSystemCallsHookOnlyForMaestroChannel(t *testing.T) {
	svc := newService(newSystemStore(), nil)
	var got []*Channel
	svc.OnSystemCreated(func(_ context.Context, ch *Channel) { got = append(got, ch) })
	ctx := context.Background()

	if _, err := svc.CreateNotices(ctx, "s2", "dono"); err != nil {
		t.Fatal(err)
	}
	if len(got) != 0 {
		t.Fatalf("hook chamado para o canal de avisos: %d", len(got))
	}
	sys, err := svc.CreateSystem(ctx, "s2", "dono")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].ID != sys.ID || got[0].ServerID != "s2" {
		t.Fatalf("hook = %+v, want 1 chamada com o canal criado", got)
	}
}
