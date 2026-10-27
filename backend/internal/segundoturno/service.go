package segundoturno

import (
	"context"
	"fmt"
	"time"
)

type store interface {
	Carregar(ctx context.Context, userID string) (Conta, error)
	// Gravar guarda a resposta; false se a pessoa já tinha respondido.
	Gravar(ctx context.Context, userID string, fezOL bool) (bool, error)
}

// BadgeRefresher reavalia os badges de alguém na hora (badge.Service).
type BadgeRefresher interface {
	Refresh(ctx context.Context, userID string)
}

type Service struct {
	store  store
	badges BadgeRefresher
	// corte: só contas criadas antes dele veem o banner.
	corte time.Time
}

func SegundoTurnoService(repository *Repository, badges BadgeRefresher, corte time.Time) *Service {
	return &Service{store: repository, badges: badges, corte: corte}
}

func (s *Service) estadoDe(c Conta) Estado {
	return Estado{Elegivel: c.CriadaEm.Before(s.corte), Respondeu: c.Respondeu, FezOL: c.FezOL}
}

// Estado diz se userID vê o banner e o que respondeu.
func (s *Service) Estado(ctx context.Context, userID string) (Estado, error) {
	c, err := s.store.Carregar(ctx, userID)
	if err != nil {
		return Estado{}, err
	}
	return s.estadoDe(c), nil
}

// Responder grava a resposta única de userID. "Sim" reavalia os badges na
// hora (o badge l e o aviso de desbloqueio saem do badge.Service); "não" só
// impede o banner de voltar.
func (s *Service) Responder(ctx context.Context, userID string, fezOL bool) (Estado, error) {
	c, err := s.store.Carregar(ctx, userID)
	if err != nil {
		return Estado{}, err
	}
	if st := s.estadoDe(c); !st.Elegivel {
		return Estado{}, ErrNaoElegivel
	} else if st.Respondeu {
		return Estado{}, ErrJaRespondeu
	}
	gravou, err := s.store.Gravar(ctx, userID, fezOL)
	if err != nil {
		return Estado{}, fmt.Errorf("gravar resposta: %w", err)
	}
	if !gravou {
		return Estado{}, ErrJaRespondeu
	}
	if fezOL {
		// A resposta já está gravada: se quem pediu desconectar agora, o
		// badge ainda precisa ser concedido e anunciado.
		s.badges.Refresh(context.WithoutCancel(ctx), userID)
	}
	return Estado{Elegivel: true, Respondeu: true, FezOL: fezOL}, nil
}
