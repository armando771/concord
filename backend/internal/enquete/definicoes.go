package enquete

import "time"

// SegundoTurno: quem já estava na Salinha no dia do segundo turno (25/10/2026)
// escolhe o badge de lembrança. Corte: contas criadas antes de 26/10/2026
// 00:00 em Brasília. Os badges l, v22 e nulo vivem em internal/badge
// (catalog_base.go). A migration 000096 zerou as respostas antigas, e todos
// os elegíveis escolhem de novo.
var SegundoTurno = Enquete{
	ID:        "segundo-turno",
	Titulo:    "Ganhe um badge da sua escolha no segundo turno:",
	Descricao: "A escolha é definitiva.",
	Corte:     time.Date(2026, 10, 26, 0, 0, 0, 0, time.FixedZone("BRT", -3*60*60)),
	Opcoes: []Opcao{
		{ID: "l", Rotulo: "L", Badge: "l"},
		{ID: "22", Rotulo: "22", Badge: "v22"},
		{ID: "nulo", Rotulo: "Nulo", Badge: "nulo"},
	},
}

// Todas são as enquetes que o app conhece, na ordem em que aparecem.
var Todas = []Enquete{SegundoTurno}
