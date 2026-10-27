package segundoturno

import (
	"errors"
	"time"
)

var (
	// ErrNaoElegivel: a conta é de depois do corte (o banner não é para ela).
	ErrNaoElegivel = errors.New("conta fora do corte do segundo turno")
	// ErrJaRespondeu: a resposta é única e não muda.
	ErrJaRespondeu          = errors.New("segundo turno já respondido")
	ErrUsuarioNaoEncontrado = errors.New("user not found")
)

// Conta é o que o serviço precisa saber de uma pessoa.
type Conta struct {
	CriadaEm  time.Time
	Respondeu bool
	FezOL     bool
}

// Estado é o que o app mostra: se há banner, e a resposta já dada.
type Estado struct {
	Elegivel  bool `json:"elegivel"`
	Respondeu bool `json:"respondeu"`
	FezOL     bool `json:"fez_o_l"`
}
