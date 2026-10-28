package badge

import "testing"

func TestEvaluateNuloOnlyForWhoChoseIt(t *testing.T) {
	for _, outra := range []string{"l", "22", "nenhum"} {
		badges, fresh := Evaluate(Stats{CreatedAt: FounderCutoff, Escolhas: map[string]bool{"segundo-turno:" + outra: true}}, nil, now)
		if hasBadge(badges, "nulo") {
			t.Fatalf("quem escolheu %q vê o badge Nulo", outra)
		}
		for _, u := range fresh {
			if u.Category == "nulo" {
				t.Fatalf("quem escolheu %q desbloqueou o Nulo: %+v", outra, u)
			}
		}
	}

	badges, fresh := Evaluate(Stats{CreatedAt: FounderCutoff, Escolhas: map[string]bool{"segundo-turno:nulo": true}}, nil, now)
	b := find(t, badges, "nulo")
	if b.Tier != 1 || b.TierName != "Votou Nulo" || b.Rarity != RarityEpic || b.Progress != 1 || b.NextThreshold != nil {
		t.Fatalf("badge nulo = %+v", b)
	}
	if hasBadge(badges, "l") || hasBadge(badges, "v22") {
		t.Fatal("quem votou nulo vê o badge do L ou do 22")
	}
	var got bool
	for _, u := range fresh {
		got = got || (u.Category == "nulo" && u.Tier == 1)
	}
	if !got {
		t.Fatalf("fresh = %+v, want nulo/1", fresh)
	}
}

// Os três badges do segundo turno têm o mesmo peso: todos épicos.
func TestBadgesDoSegundoTurnoSaoEpicos(t *testing.T) {
	for _, key := range []string{"l", "v22", "nulo"} {
		var achou bool
		for _, c := range Catalog {
			if c.Key != key {
				continue
			}
			achou = true
			if !c.Exclusive || len(c.Tiers) != 1 || c.Tiers[0].Rarity != RarityEpic {
				t.Errorf("%s: want exclusivo, 1 tier épico, got %+v", key, c)
			}
		}
		if !achou {
			t.Errorf("badge %q não está no catálogo", key)
		}
	}
}
