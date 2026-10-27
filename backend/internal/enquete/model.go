package enquete

import (
	"errors"
	"time"
)

var (
	ErrEnqueteInexistente   = errors.New("enquete não encontrada")
	ErrOpcaoInvalida        = errors.New("opção inválida")
	ErrNaoElegivel          = errors.New("conta fora do corte da enquete")
	ErrJaRespondeu          = errors.New("enquete já respondida")
	ErrUsuarioNaoEncontrado = errors.New("user not found")
)

// Opcao é uma resposta possível. Badge é a categoria concedida a quem a
// escolhe (internal/badge); vazio = nenhum badge.
type Opcao struct {
	ID     string `json:"id"`
	Rotulo string `json:"rotulo"`
	Badge  string `json:"badge,omitempty"`
}

// Enquete é uma pergunta de escolha única, definida em código (definicoes.go).
type Enquete struct {
	ID        string `json:"id"`
	Titulo    string `json:"titulo"`
	Descricao string `json:"descricao"`
	// Corte: só contas criadas antes dele veem a enquete.
	Corte  time.Time `json:"-"`
	Opcoes []Opcao   `json:"opcoes"`
}

// Conta é o que o serviço precisa saber de uma pessoa.
type Conta struct {
	CriadaEm time.Time
	// Respostas já dadas: enquete -> opção.
	Respostas map[string]string
}

// Resposta é o que o POST devolve.
type Resposta struct {
	Enquete string `json:"enquete"`
	Opcao   string `json:"opcao"`
	Badge   string `json:"badge,omitempty"`
}
