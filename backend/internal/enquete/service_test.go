package enquete

import (
	"context"
	"errors"
	"testing"
	"time"
)

var corte = time.Date(2026, 10, 26, 0, 0, 0, 0, time.UTC)

var enqueteTeste = Enquete{
	ID:    "teste",
	Corte: corte,
	Opcoes: []Opcao{
		{ID: "a", Rotulo: "A", Badge: "badge-a"},
		{ID: "nenhum", Rotulo: "Nenhum"},
	},
}

type fakeStore struct {
	contas  map[string]Conta
	gravado map[string]string
	// perdeCorrida simula outro pedido gravando antes (Gravar devolve false).
	perdeCorrida bool
	err          error
}

func (f *fakeStore) Carregar(_ context.Context, userID string) (Conta, error) {
	if f.err != nil {
		return Conta{}, f.err
	}
	c, ok := f.contas[userID]
	if !ok {
		return Conta{}, ErrUsuarioNaoEncontrado
	}
	return c, nil
}

func (f *fakeStore) Gravar(_ context.Context, userID, enquete, opcao string) (bool, error) {
	if f.err != nil {
		return false, f.err
	}
	if f.perdeCorrida {
		return false, nil
	}
	f.gravado[userID+"/"+enquete] = opcao
	return true, nil
}

type fakeRefresher struct {
	chamados []string
	// ctxErr é o erro do contexto que o Refresh recebeu.
	ctxErr error
}

func (f *fakeRefresher) Refresh(ctx context.Context, userID string) {
	f.chamados = append(f.chamados, userID)
	f.ctxErr = ctx.Err()
}

func novoServico(contas map[string]Conta) (*Service, *fakeStore, *fakeRefresher) {
	st := &fakeStore{contas: contas, gravado: map[string]string{}}
	rf := &fakeRefresher{}
	return &Service{store: st, badges: rf, enquetes: []Enquete{enqueteTeste}}, st, rf
}

func antes() Conta  { return Conta{CriadaEm: corte.Add(-time.Hour)} }
func depois() Conta { return Conta{CriadaEm: corte.Add(time.Hour)} }

func TestPendentesSoParaElegiveisQueNaoResponderam(t *testing.T) {
	respondida := antes()
	respondida.Respostas = map[string]string{"teste": "a"}
	s, _, _ := novoServico(map[string]Conta{
		"velha": antes(), "nova": depois(), "no-corte": {CriadaEm: corte}, "ja": respondida,
	})
	casos := map[string]int{"velha": 1, "nova": 0, "no-corte": 0, "ja": 0}
	for id, quer := range casos {
		got, err := s.Pendentes(context.Background(), id)
		if err != nil || len(got) != quer {
			t.Fatalf("%s: pendentes = %v, err = %v, quer %d", id, got, err, quer)
		}
		if got == nil {
			t.Fatalf("%s: pendentes nil (o JSON precisa ser [])", id)
		}
	}
}

func TestPendentesUsuarioInexistente(t *testing.T) {
	s, _, _ := novoServico(map[string]Conta{})
	if _, err := s.Pendentes(context.Background(), "ninguem"); !errors.Is(err, ErrUsuarioNaoEncontrado) {
		t.Fatalf("err = %v", err)
	}
}

func TestResponderComBadgeGravaEReavalia(t *testing.T) {
	s, st, rf := novoServico(map[string]Conta{"ana": antes()})
	got, err := s.Responder(context.Background(), "ana", "teste", "a")
	if err != nil {
		t.Fatal(err)
	}
	if got != (Resposta{Enquete: "teste", Opcao: "a", Badge: "badge-a"}) || st.gravado["ana/teste"] != "a" {
		t.Fatalf("resposta = %+v, gravado = %v", got, st.gravado)
	}
	if len(rf.chamados) != 1 || rf.chamados[0] != "ana" {
		t.Fatalf("Refresh chamado = %v, quer [ana]", rf.chamados)
	}
}

func TestResponderSemBadgeNaoMexeNosBadges(t *testing.T) {
	s, st, rf := novoServico(map[string]Conta{"ana": antes()})
	got, err := s.Responder(context.Background(), "ana", "teste", "nenhum")
	if err != nil {
		t.Fatal(err)
	}
	if got.Badge != "" || st.gravado["ana/teste"] != "nenhum" {
		t.Fatalf("resposta = %+v, gravado = %v", got, st.gravado)
	}
	if len(rf.chamados) != 0 {
		t.Fatalf("Refresh não devia ser chamado: %v", rf.chamados)
	}
}

func TestResponderRecusa(t *testing.T) {
	respondida := antes()
	respondida.Respostas = map[string]string{"teste": "a"}
	casos := []struct {
		nome  string
		conta Conta
		enq   string
		opcao string
		store func(*fakeStore)
		erro  error
	}{
		{"conta depois do corte", depois(), "teste", "a", nil, ErrNaoElegivel},
		{"já respondeu", respondida, "teste", "a", nil, ErrJaRespondeu},
		{"outro pedido gravou antes", antes(), "teste", "a", func(f *fakeStore) { f.perdeCorrida = true }, ErrJaRespondeu},
		{"enquete inexistente", antes(), "outra", "a", nil, ErrEnqueteInexistente},
		{"opção inexistente", antes(), "teste", "zzz", nil, ErrOpcaoInvalida},
		{"falha do banco", antes(), "teste", "a", func(f *fakeStore) { f.err = errors.New("db down") }, nil},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			s, st, rf := novoServico(map[string]Conta{"ana": c.conta})
			if c.store != nil {
				c.store(st)
			}
			_, err := s.Responder(context.Background(), "ana", c.enq, c.opcao)
			if err == nil || (c.erro != nil && !errors.Is(err, c.erro)) {
				t.Fatalf("err = %v, quer %v", err, c.erro)
			}
			if len(st.gravado) != 0 || len(rf.chamados) != 0 {
				t.Fatalf("não devia gravar nem reavaliar: %v %v", st.gravado, rf.chamados)
			}
		})
	}
}

func TestResponderUsuarioInexistente(t *testing.T) {
	s, _, _ := novoServico(map[string]Conta{})
	if _, err := s.Responder(context.Background(), "ninguem", "teste", "a"); !errors.Is(err, ErrUsuarioNaoEncontrado) {
		t.Fatalf("err = %v", err)
	}
}

// Se quem pediu desconectar logo depois de gravar, o badge ainda tem que sair.
func TestResponderReavaliaMesmoComPedidoCancelado(t *testing.T) {
	s, _, rf := novoServico(map[string]Conta{"ana": antes()})
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := s.Responder(ctx, "ana", "teste", "a"); err != nil {
		t.Fatal(err)
	}
	if len(rf.chamados) != 1 || rf.ctxErr != nil {
		t.Fatalf("Refresh chamado = %v, ctx.Err() = %v, quer 1 chamada com contexto vivo", rf.chamados, rf.ctxErr)
	}
}

func TestDefinicaoDoSegundoTurno(t *testing.T) {
	e := SegundoTurno
	if e.ID != "segundo-turno" || len(Todas) != 1 || Todas[0].ID != e.ID {
		t.Fatalf("definição = %+v, Todas = %v", e, Todas)
	}
	quer := map[string]string{"l": "l", "22": "v22", "nenhum": ""}
	if len(e.Opcoes) != len(quer) {
		t.Fatalf("opções = %+v", e.Opcoes)
	}
	for _, o := range e.Opcoes {
		if b, ok := quer[o.ID]; !ok || o.Badge != b || o.Rotulo == "" {
			t.Fatalf("opção %+v inesperada", o)
		}
	}
	// Quem criou a conta no dia 25 (23:59 em Brasília) entra; no dia 26 não.
	brt := time.FixedZone("BRT", -3*60*60)
	if !time.Date(2026, 10, 25, 23, 59, 0, 0, brt).Before(e.Corte) || time.Date(2026, 10, 26, 0, 0, 0, 0, brt).Before(e.Corte) {
		t.Fatalf("corte = %v", e.Corte)
	}
}
