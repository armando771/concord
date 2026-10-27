package segundoturno

import (
	"context"
	"errors"
	"testing"
	"time"
)

var corte = time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)

type fakeStore struct {
	contas  map[string]Conta
	gravado map[string]bool
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

func (f *fakeStore) Gravar(_ context.Context, userID string, fezOL bool) (bool, error) {
	if f.err != nil {
		return false, f.err
	}
	if f.perdeCorrida {
		return false, nil
	}
	f.gravado[userID] = fezOL
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
	st := &fakeStore{contas: contas, gravado: map[string]bool{}}
	rf := &fakeRefresher{}
	return &Service{store: st, badges: rf, corte: corte}, st, rf
}

func antes() Conta  { return Conta{CriadaEm: corte.Add(-time.Hour)} }
func depois() Conta { return Conta{CriadaEm: corte.Add(time.Hour)} }

func TestEstadoElegivelSoAntesDoCorte(t *testing.T) {
	s, _, _ := novoServico(map[string]Conta{"velha": antes(), "nova": depois(), "no-corte": {CriadaEm: corte}})
	casos := map[string]bool{"velha": true, "nova": false, "no-corte": false}
	for id, quer := range casos {
		got, err := s.Estado(context.Background(), id)
		if err != nil || got.Elegivel != quer || got.Respondeu {
			t.Fatalf("%s: estado = %+v, err = %v, quer elegivel=%v", id, got, err, quer)
		}
	}
}

func TestEstadoMostraARespostaGravada(t *testing.T) {
	c := antes()
	c.Respondeu, c.FezOL = true, true
	s, _, _ := novoServico(map[string]Conta{"ana": c})
	got, err := s.Estado(context.Background(), "ana")
	if err != nil || !got.Respondeu || !got.FezOL || !got.Elegivel {
		t.Fatalf("estado = %+v, err = %v", got, err)
	}
}

func TestResponderSimGravaEReavaliaOBadge(t *testing.T) {
	s, st, rf := novoServico(map[string]Conta{"ana": antes()})
	got, err := s.Responder(context.Background(), "ana", true)
	if err != nil {
		t.Fatal(err)
	}
	if !got.Respondeu || !got.FezOL || !st.gravado["ana"] {
		t.Fatalf("estado = %+v, gravado = %v", got, st.gravado)
	}
	if len(rf.chamados) != 1 || rf.chamados[0] != "ana" {
		t.Fatalf("Refresh chamado = %v, quer [ana]", rf.chamados)
	}
}

func TestResponderNaoGravaSemMexerNoBadge(t *testing.T) {
	s, st, rf := novoServico(map[string]Conta{"ana": antes()})
	got, err := s.Responder(context.Background(), "ana", false)
	if err != nil {
		t.Fatal(err)
	}
	v, gravou := st.gravado["ana"]
	if !got.Respondeu || got.FezOL || !gravou || v {
		t.Fatalf("estado = %+v, gravado = %v", got, st.gravado)
	}
	if len(rf.chamados) != 0 {
		t.Fatalf("Refresh não devia ser chamado: %v", rf.chamados)
	}
}

func TestResponderRecusa(t *testing.T) {
	respondida := antes()
	respondida.Respondeu = true
	casos := []struct {
		nome  string
		conta Conta
		store func(*fakeStore)
		erro  error
	}{
		{"conta depois do corte", depois(), nil, ErrNaoElegivel},
		{"já respondeu", respondida, nil, ErrJaRespondeu},
		{"outro pedido gravou antes", antes(), func(f *fakeStore) { f.perdeCorrida = true }, ErrJaRespondeu},
		{"falha do banco", antes(), func(f *fakeStore) { f.err = errors.New("db down") }, nil},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			s, st, rf := novoServico(map[string]Conta{"ana": c.conta})
			if c.store != nil {
				c.store(st)
			}
			_, err := s.Responder(context.Background(), "ana", true)
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
	if _, err := s.Responder(context.Background(), "ninguem", true); !errors.Is(err, ErrUsuarioNaoEncontrado) {
		t.Fatalf("err = %v", err)
	}
}

// Se quem pediu desconectar logo depois de gravar, o badge ainda tem que sair.
func TestResponderSimReavaliaMesmoComPedidoCancelado(t *testing.T) {
	s, _, rf := novoServico(map[string]Conta{"ana": antes()})
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := s.Responder(ctx, "ana", true); err != nil {
		t.Fatal(err)
	}
	if len(rf.chamados) != 1 || rf.ctxErr != nil {
		t.Fatalf("Refresh chamado = %v, ctx.Err() = %v, quer 1 chamada com contexto vivo", rf.chamados, rf.ctxErr)
	}
}
