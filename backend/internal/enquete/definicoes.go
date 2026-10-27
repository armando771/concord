package enquete

import "time"

// SegundoTurno: quem já estava na Salinha no dia do segundo turno (25/10/2026)
// escolhe o badge de lembrança. Corte: contas criadas antes de 26/10/2026
// 00:00 em Brasília. Os badges l e v22 vivem em internal/badge (catalog.go).
var SegundoTurno = Enquete{
	ID:        "segundo-turno",
	Titulo:    "Escolha o seu badge do segundo turno",
	Descricao: "Você já estava na Salinha no dia, então pode escolher um badge de lembrança. A escolha é definitiva.",
	Corte:     time.Date(2026, 10, 26, 0, 0, 0, 0, time.FixedZone("BRT", -3*60*60)),
	Opcoes: []Opcao{
		{ID: "l", Rotulo: "Fez o L", Badge: "l"},
		{ID: "22", Rotulo: "Fez o 22", Badge: "v22"},
		{ID: "nenhum", Rotulo: "Prefiro não dizer"},
	},
}

// Todas são as enquetes que o app conhece, na ordem em que aparecem.
var Todas = []Enquete{SegundoTurno}
