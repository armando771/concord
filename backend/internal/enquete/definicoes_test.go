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
