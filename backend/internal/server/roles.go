package server

import "errors"

// Cargos: "admin" aparece como Moderador no app (cria/edita canais e
// servidor); "member" é o padrão. O dono é quem criou o servidor.
const (
	RoleModerator = "admin"
	RoleMember    = "member"
)

var (
	ErrOnlyOwner   = errors.New("só o dono do servidor muda cargos")
	ErrOwnerRole   = errors.New("o cargo do dono não muda")
	ErrInvalidRole = errors.New("cargo inválido")
)

func validateRoleChange(actorID, ownerID, targetID, role string) error {
	if actorID != ownerID {
		return ErrOnlyOwner
	}
	if targetID == ownerID {
		return ErrOwnerRole
	}
	if role != RoleModerator && role != RoleMember {
		return ErrInvalidRole
	}
	return nil
}
