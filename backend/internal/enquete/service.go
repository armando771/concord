package enquete

import (
	"context"
	"fmt"
)

type store interface {
	Carregar(ctx context.Context, userID string) (Conta, error)
	// Gravar guarda a resposta; false se a pessoa já tinha respondido.
	Gravar(ctx context.Context, userID, enquete, opcao string) (bool, error)
}

// BadgeRefresher reavalia os badges de alguém na hora (badge.Service).
type BadgeRefresher interface {
	Refresh(ctx context.Context, userID string)
}

type Service struct {
	store    store
	badges   BadgeRefresher
	enquetes []Enquete
}

func EnqueteService(repository *Repository, badges BadgeRefresher, enquetes []Enquete) *Service {
	return &Service{store: repository, badges: badges, enquetes: enquetes}
}

func elegivel(e Enquete, c Conta) bool { return c.CriadaEm.Before(e.Corte) }

// Pendentes são as enquetes que userID pode responder e ainda não respondeu.
// Nunca devolve nil (o JSON precisa ser []).
func (s *Service) Pendentes(ctx context.Context, userID string) ([]Enquete, error) {
	c, err := s.store.Carregar(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := []Enquete{}
	for _, e := range s.enquetes {
		if _, respondeu := c.Respostas[e.ID]; elegivel(e, c) && !respondeu {
			out = append(out, e)
		}
	}
	return out, nil
}

func (s *Service) achar(id string) (Enquete, bool) {
	for _, e := range s.enquetes {
		if e.ID == id {
			return e, true
		}
	}
	return Enquete{}, false
}

func achaOpcao(e Enquete, id string) (Opcao, bool) {
	for _, o := range e.Opcoes {
		if o.ID == id {
			return o, true
		}
	}
	return Opcao{}, false
}

// Responder grava a resposta única de userID. Opção com badge reavalia os
// badges na hora (o desbloqueio e o aviso saem do badge.Service); as outras só
// impedem a pergunta de voltar.
func (s *Service) Responder(ctx context.Context, userID, enqueteID, opcaoID string) (Resposta, error) {
	e, ok := s.achar(enqueteID)
	if !ok {
		return Resposta{}, ErrEnqueteInexistente
	}
	op, ok := achaOpcao(e, opcaoID)
	if !ok {
		return Resposta{}, ErrOpcaoInvalida
	}
	c, err := s.store.Carregar(ctx, userID)
	if err != nil {
		return Resposta{}, err
	}
	if !elegivel(e, c) {
		return Resposta{}, ErrNaoElegivel
	}
	if _, ja := c.Respostas[e.ID]; ja {
		return Resposta{}, ErrJaRespondeu
	}
	gravou, err := s.store.Gravar(ctx, userID, e.ID, op.ID)
	if err != nil {
		return Resposta{}, fmt.Errorf("gravar resposta: %w", err)
	}
	if !gravou {
		return Resposta{}, ErrJaRespondeu
	}
	if op.Badge != "" {
		// A resposta já está gravada: se quem pediu desconectar agora, o
		// badge ainda precisa ser concedido e anunciado.
		s.badges.Refresh(context.WithoutCancel(ctx), userID)
	}
	return Resposta{Enquete: e.ID, Opcao: op.ID, Badge: op.Badge}, nil
}
