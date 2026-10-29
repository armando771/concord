package guest

import (
	"testing"
	"time"
)

func TestIndexLookups(t *testing.T) {
	now := time.Now()
	x := newIndex()
	a := Pass{ID: "p1", UserID: "u", ServerID: "s1", ChannelID: "c1", ExpiresAt: now.Add(time.Hour)}
	b := Pass{ID: "p2", UserID: "u", ServerID: "s2", ChannelID: "c2", ExpiresAt: now.Add(2 * time.Hour)}
	x.put(a)
	x.put(b)

	if _, ok := x.inChannel("u", "c1", now); !ok {
		t.Fatal("acesso a c1 devia valer")
	}
	if _, ok := x.inChannel("u", "c3", now); ok {
		t.Fatal("c3 não é permitido")
	}
	if _, ok := x.inChannel("u", "c1", now.Add(90*time.Minute)); ok {
		t.Fatal("vencido não vale")
	}
	if p, _ := x.latest("u", now); p.ID != "p2" {
		t.Fatalf("latest = %s, want p2 (vence depois)", p.ID)
	}
	if _, ok := x.latest("ninguém", now); ok {
		t.Fatal("quem não tem acesso não é visitante")
	}
	if _, ok := x.inServer("u", "s1", now); !ok {
		t.Fatal("acesso em s1 devia valer")
	}

	x.moveTo("u", "s1", "c9")
	if _, ok := x.inChannel("u", "c9", now); !ok {
		t.Fatal("depois de mover, o canal novo vale")
	}
	x.moveTo("u", "s-outro", "c1") // sem acesso no servidor: nada muda

	// remove só tira o mesmo acesso (um novo no lugar fica).
	x.remove(Pass{ID: "velho", UserID: "u", ServerID: "s2"})
	if _, ok := x.inServer("u", "s2", now); !ok {
		t.Fatal("remover um acesso antigo não pode tirar o atual")
	}
	x.remove(a)
	x.remove(b)
	if got := x.matching(func(Pass) bool { return true }); len(got) != 0 {
		t.Fatalf("sobrou %v", got)
	}
}
