package enquete

import (
	"testing"
	"time"

	"gin-quickstart/backend/internal/badge"
)

// Se um ID de enquete ou de opção mudar, o badge deixa de ser concedido sem
// erro nenhum (badge/evaluate.go lê "enquete:opcao"). Este teste prende as duas pontas.
func TestOpcoesComBadgeSaoConcedidasPeloCatalogo(t *testing.T) {
	existe := map[string]bool{}
	for _, c := range badge.Catalog {
		existe[c.Key] = true
	}
	now := time.Date(2026, 11, 1, 12, 0, 0, 0, time.UTC)
	for _, e := range Todas {
		for _, o := range e.Opcoes {
			if o.Badge == "" {
				continue
			}
			if !existe[o.Badge] {
				t.Errorf("%s/%s: badge %q não existe no catálogo", e.ID, o.ID, o.Badge)
				continue
			}
			stats := badge.Stats{
				CreatedAt: badge.FounderCutoff,
				Escolhas:  map[string]bool{e.ID + ":" + o.ID: true},
			}
			badges, _ := badge.Evaluate(stats, nil, now)
			concedido := false
			for _, b := range badges {
				if b.Category == o.Badge && b.Tier > 0 {
					concedido = true
				}
			}
			if !concedido {
				t.Errorf("%s/%s: escolher a opção não concede o badge %q", e.ID, o.ID, o.Badge)
			}
		}
	}
}

// O modal pergunta "Ganhe um badge da sua escolha no segundo turno:" e não tem
// mais "Prefiro não dizer": L, 22 e Nulo, cada um com seu badge.
func TestSegundoTurnoTemTresOpcoesComBadge(t *testing.T) {
	if SegundoTurno.Titulo != "Ganhe um badge da sua escolha no segundo turno:" {
		t.Errorf("título = %q", SegundoTurno.Titulo)
	}
	want := []Opcao{
		{ID: "l", Rotulo: "L", Badge: "l"},
		{ID: "22", Rotulo: "22", Badge: "v22"},
		{ID: "nulo", Rotulo: "Nulo", Badge: "nulo"},
	}
	if len(SegundoTurno.Opcoes) != len(want) {
		t.Fatalf("opções = %+v, want %+v", SegundoTurno.Opcoes, want)
	}
	for i, o := range want {
		if SegundoTurno.Opcoes[i] != o {
			t.Errorf("opção %d = %+v, want %+v", i, SegundoTurno.Opcoes[i], o)
		}
	}
}

// O badge espelha o ID, o corte e os badges da enquete para contar os
// "badges ocultos" (badge/hidden.go): se um mudar aqui, o número erra.
func TestSegundoTurnoEspelhadoNoBadge(t *testing.T) {
	if SegundoTurno.ID != badge.SegundoTurnoID || !SegundoTurno.Corte.Equal(badge.SegundoTurnoCorte) {
		t.Fatalf("enquete %q/%v x badge %q/%v", SegundoTurno.ID, SegundoTurno.Corte, badge.SegundoTurnoID, badge.SegundoTurnoCorte)
	}
	if len(SegundoTurno.Opcoes) != len(badge.SegundoTurnoBadges) {
		t.Fatalf("opções = %+v, badges = %v", SegundoTurno.Opcoes, badge.SegundoTurnoBadges)
	}
	for i, o := range SegundoTurno.Opcoes {
		if o.Badge != badge.SegundoTurnoBadges[i] {
			t.Errorf("opção %q dá %q, o badge espera %q", o.ID, o.Badge, badge.SegundoTurnoBadges[i])
		}
	}
}
