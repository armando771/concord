// Package savedprofile guarda perfis prontos (issue #344): a pessoa salva o
// perfil inteiro com um nome e troca entre eles com um clique. Avatar e
// banner vão por referência à mídia que já existe (ADR 0011).
package savedprofile

import (
	"errors"
	"time"

	"gin-quickstart/backend/internal/user"
)

const (
	// MaxPerUser: quantos perfis salvos cada pessoa pode ter.
	MaxPerUser = 10
	// MaxNameLength: tamanho do nome do perfil salvo, em caracteres.
	MaxNameLength = 32
)

var (
	ErrNotFound    = errors.New("perfil salvo não encontrado")
	ErrInvalidName = errors.New("o nome precisa ter de 1 a 32 caracteres, sem caracteres invisíveis")
	ErrNameTaken   = errors.New("já existe um perfil salvo com esse nome")
	ErrLimit       = errors.New("você já tem 10 perfis salvos: exclua um para salvar outro")
)

// SavedProfile é um perfil salvo: o nome e a foto do perfil (campos, avatar e
// banner) do momento em que foi salvo.
type SavedProfile struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	user.ProfileSnapshot
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
