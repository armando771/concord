package badge

import (
	"strings"
	"time"
)

// Badges ocultos: quantos badges a pessoa ainda não tem e ainda pode
// conseguir. Só o número sai na API (como as conquistas secretas da Steam);
// nome, chave e limite de cada um continuam escondidos até a conquista.

// SegundoTurnoID e SegundoTurnoCorte espelham internal/enquete (o pacote
// enquete importa este nas suas provas, então o espelho fica aqui; o teste de
// enquete confere que os dois não se afastam).
const SegundoTurnoID = "segundo-turno"

var SegundoTurnoCorte = time.Date(2026, 10, 26, 0, 0, 0, 0, time.FixedZone("BRT", -3*60*60))

// SegundoTurnoBadges são os badges da enquete do segundo turno: a escolha é
// definitiva, então a pessoa só pode ficar com um dos três.
var SegundoTurnoBadges = []string{"l", "v22", "nulo"}

func isSegundoTurno(key string) bool {
	for _, k := range SegundoTurnoBadges {
		if k == key {
			return true
		}
	}
	return false
}

// answeredSegundoTurno: a pessoa já escolheu na enquete (qualquer opção).
func answeredSegundoTurno(s Stats) bool {
	for k, on := range s.Escolhas {
		if on && strings.HasPrefix(k, SegundoTurnoID+":") {
			return true
		}
	}
	return false
}

// canStillChooseSegundoTurno: conta dentro do corte e sem resposta.
func canStillChooseSegundoTurno(s Stats) bool {
	return s.CreatedAt.Before(SegundoTurnoCorte) && !answeredSegundoTurno(s)
}

// closedFor: categorias que quem não tem não consegue mais ter. Caçador de
// bugs (concedido pela equipe, mas qualquer um pode reportar) e Primeira
// mensagem (exclusiva, mas qualquer um pode ser a primeira) seguem abertos.
func closedFor(key string, s Stats) bool {
	switch key {
	case "criador": // só dos devs
		return true
	case "fundador": // Pioneiro: quem entrou depois do corte nunca terá
		return !isFounder(s.CreatedAt)
	case "top10": // as 10 vagas acabaram
		return s.Top10Full
	}
	return false
}

// HiddenRemaining conta as categorias que a pessoa ainda não tem (earned são
// as que ela tem) e ainda pode conseguir. A enquete do segundo turno vale 1,
// por ser uma escolha só.
func HiddenRemaining(s Stats, earned []Badge) int {
	have := make(map[string]bool, len(earned))
	for _, b := range earned {
		have[b.Category] = true
	}
	n, pollCounted := 0, false
	for _, c := range Catalog {
		switch {
		case have[c.Key] || closedFor(c.Key, s):
		case isSegundoTurno(c.Key):
			if !pollCounted && canStillChooseSegundoTurno(s) && !hasAny(have, SegundoTurnoBadges) {
				n++
				pollCounted = true
			}
		default:
			n++
		}
	}
	return n
}

func hasAny(have map[string]bool, keys []string) bool {
	for _, k := range keys {
		if have[k] {
			return true
		}
	}
	return false
}
