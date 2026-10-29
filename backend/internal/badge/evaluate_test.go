package badge

import (
	"testing"
	"time"
)

var now = time.Date(2026, 10, 25, 15, 0, 0, 0, time.UTC)

func find(t *testing.T, badges []Badge, key string) Badge {
	t.Helper()
	for _, b := range badges {
		if b.Category == key {
			return b
		}
	}
	t.Fatalf("badge %q missing", key)
	return Badge{}
}

func TestCatalogIsWellFormed(t *testing.T) {
	seen := map[string]bool{}
	valid := map[string]bool{RarityCommon: true, RarityRare: true, RarityEpic: true, RarityLegendary: true, RarityMythic: true}
	for _, c := range Catalog {
		if seen[c.Key] {
			t.Fatalf("duplicate category %q", c.Key)
		}
		seen[c.Key] = true
		if c.Name == "" || c.Description == "" || len(c.Tiers) == 0 {
			t.Fatalf("category %q incomplete", c.Key)
		}
		for i, tier := range c.Tiers {
			// Mítico é só dos badges exclusivos (nem todo exclusivo é mítico).
			if tier.Rarity == RarityMythic && !c.Exclusive {
				t.Fatalf("%s tier %d: rarity %q with exclusive=%v", c.Key, i+1, tier.Rarity, c.Exclusive)
			}
			if !valid[tier.Rarity] {
				t.Fatalf("%s tier %d has rarity %q", c.Key, i+1, tier.Rarity)
			}
			if i > 0 && tier.Threshold <= c.Tiers[i-1].Threshold {
				t.Fatalf("%s tier %d threshold does not grow", c.Key, i+1)
			}
		}
	}
	if len(Catalog) < 12 {
		t.Fatalf("catalog has %d categories, want the 12 planned", len(Catalog))
	}
}

func TestTierForValue(t *testing.T) {
	var voz Category
	for _, c := range Catalog {
		if c.Key == "voz" {
			voz = c
		}
	}
	cases := []struct {
		value int64
		want  int
	}{
		{0, 0},
		{hour - 1, 0},
		{hour, 1},
		{10*hour - 1, 1},
		{10 * hour, 2},
		{5000 * hour, 6},
	}
	for _, c := range cases {
		if got := tierFor(voz, c.value); got != c.want {
			t.Errorf("tierFor(voz, %d) = %d, want %d", c.value, got, c.want)
		}
	}
}

func TestMonthsBetween(t *testing.T) {
	created := time.Date(2026, 1, 31, 10, 0, 0, 0, time.UTC)
	cases := []struct {
		at   time.Time
		want int64
	}{
		{created, 0},
		{time.Date(2026, 2, 28, 10, 0, 0, 0, time.UTC), 0}, // 31/1 + 1 mês = 3/3
		{time.Date(2026, 3, 3, 10, 0, 0, 0, time.UTC), 1},
		{time.Date(2027, 1, 31, 9, 59, 0, 0, time.UTC), 11},
		{time.Date(2027, 1, 31, 10, 0, 0, 0, time.UTC), 12},
		{time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC), 0}, // relógio para trás
	}
	for _, c := range cases {
		if got := monthsBetween(created, c.at); got != c.want {
			t.Errorf("monthsBetween(%v) = %d, want %d", c.at, got, c.want)
		}
	}
}

func TestEvaluateComputesTierProgressAndNext(t *testing.T) {
	stats := Stats{CreatedAt: now.AddDate(0, -2, 0), VoiceSeconds: 30 * hour}
	badges, _ := Evaluate(stats, nil, now)

	voz := find(t, badges, "voz")
	if voz.Tier != 2 || voz.TierName != "Tagarela" || voz.Rarity != RarityCommon {
		t.Fatalf("voz = tier %d %q %q, want 2 Tagarela comum", voz.Tier, voz.TierName, voz.Rarity)
	}
	if voz.NextThreshold == nil || *voz.NextThreshold != 50*hour || voz.NextTierName != "Locutor" {
		t.Fatalf("voz next = %v %q, want 50h Locutor", voz.NextThreshold, voz.NextTierName)
	}
	// De 10h a 50h, com 30h: metade.
	if voz.Progress != 0.5 {
		t.Fatalf("voz progress = %v, want 0.5", voz.Progress)
	}
	// A escada inteira: os 2 conquistados com dia, os de cima sem.
	if len(voz.Tiers) != 6 || voz.Tiers[1].UnlockedAt == nil || voz.Tiers[2].UnlockedAt != nil {
		t.Fatalf("voz ladder = %+v", voz.Tiers)
	}

	conta := find(t, badges, "conta")
	if conta.Value != 2 || conta.Tier != 1 {
		t.Fatalf("conta = value %d tier %d, want 2 meses, tier 1", conta.Value, conta.Tier)
	}
	if conta.NextAt == nil || !conta.NextAt.Equal(stats.CreatedAt.AddDate(0, 3, 0)) {
		t.Fatalf("conta next_at = %v", conta.NextAt)
	}
}

func TestEvaluateHidesCategoriesWithoutTier1(t *testing.T) {
	badges, fresh := Evaluate(Stats{CreatedAt: FounderCutoff}, nil, now)
	// Conta nova (depois do corte do Pioneiro), sem uso: nenhuma categoria
	// atingiu o tier 1.
	if len(badges) != 0 || len(fresh) != 0 {
		t.Fatalf("badges = %+v fresh = %+v, want nada", badges, fresh)
	}
}

func TestEvaluateHidesCategoryJustBelowTier1(t *testing.T) {
	first := category(t, "mensagens").Tiers[0].Threshold
	below, _ := Evaluate(Stats{CreatedAt: FounderCutoff, MessagesSent: first - 1}, nil, now)
	if hasBadge(below, "mensagens") {
		t.Fatalf("mensagens apareceu faltando 1 para o tier 1: %+v", below)
	}
	at, fresh := Evaluate(Stats{CreatedAt: FounderCutoff, MessagesSent: first}, nil, now)
	if m := find(t, at, "mensagens"); m.Tier != 1 || m.Tiers[1].UnlockedAt != nil {
		t.Fatalf("mensagens = %+v, want tier 1", m)
	}
	if len(fresh) != 1 || fresh[0].Category != "mensagens" || fresh[0].Tier != 1 {
		t.Fatalf("fresh = %+v, want o desbloqueio do tier 1 (o aviso continua)", fresh)
	}
}

func TestEvaluateMaxTierHasNoNext(t *testing.T) {
	badges, _ := Evaluate(Stats{CreatedAt: now, PeakCallSize: 40}, nil, now)
	party := find(t, badges, "festeiro")
	if party.Tier != 3 || party.NextThreshold != nil || party.NextTierName != "" || party.Progress != 1 {
		t.Fatalf("festeiro maxed = %+v", party)
	}
}

func TestEvaluateLevelFromXP(t *testing.T) {
	// Nível 25 começa em sum(XPToNext(1..24)).
	var xp int64
	for l := int64(1); l < 25; l++ {
		xp += 5*l*l + 50*l + 100
	}
	badges, _ := Evaluate(Stats{CreatedAt: now, XP: xp}, nil, now)
	if nivel := find(t, badges, "nivel"); nivel.Value != 25 || nivel.Tier != 2 {
		t.Fatalf("nivel = value %d tier %d, want 25/2", nivel.Value, nivel.Tier)
	}
}

func TestEvaluateFounderCutoff(t *testing.T) {
	early, _ := Evaluate(Stats{CreatedAt: FounderCutoff.Add(-time.Minute)}, nil, now)
	if f := find(t, early, "fundador"); f.Tier != 1 || f.Rarity != RarityLegendary {
		t.Fatalf("early account fundador = %+v", f)
	}
	late, _ := Evaluate(Stats{CreatedAt: FounderCutoff}, nil, FounderCutoff.AddDate(0, 1, 0))
	if hasBadge(late, "fundador") {
		t.Fatalf("conta depois do corte não vê o Pioneiro: %+v", late)
	}
}

func TestEvaluateReportsFreshUnlocksWithTheirTime(t *testing.T) {
	created := time.Date(2026, 3, 10, 12, 0, 0, 0, time.UTC)
	stats := Stats{CreatedAt: created, MessagesSent: 600}
	// Puxa-assunto já tinha sido gravado; Papo Reto é novo.
	before := now.Add(-48 * time.Hour)
	stored := Unlocks{"mensagens": {1: before}}

	badges, fresh := Evaluate(stats, stored, now)

	want := map[string]time.Time{
		"mensagens/2": now,
		// Idade da conta: o dia exato em que fez 1, 3 e 6 meses.
		"conta/1": created.AddDate(0, 1, 0),
		"conta/2": created.AddDate(0, 3, 0),
		"conta/3": created.AddDate(0, 6, 0),
		// Pioneiro: desde que criou a conta.
		"fundador/1": created,
	}
	if len(fresh) != len(want) {
		t.Fatalf("fresh = %+v, want %d unlocks", fresh, len(want))
	}
	for _, u := range fresh {
		key := u.Category + "/" + string(rune('0'+u.Tier))
		at, ok := want[key]
		if !ok || !u.At.Equal(at) {
			t.Errorf("unexpected unlock %s at %v", key, u.At)
		}
	}

	msgs := find(t, badges, "mensagens")
	if msgs.Tier != 2 || msgs.UnlockedAt == nil || !msgs.UnlockedAt.Equal(now) {
		t.Fatalf("mensagens = %+v", msgs)
	}
	if !msgs.Tiers[0].UnlockedAt.Equal(before) {
		t.Fatalf("stored unlock time not kept: %v", msgs.Tiers[0].UnlockedAt)
	}
}

func TestEvaluateKeepsEarnedTierWhenValueDrops(t *testing.T) {
	// Apagou os servidores: o badge conquistado continua.
	stored := Unlocks{"dono": {1: now.Add(-time.Hour), 2: now.Add(-time.Hour)}}
	badges, fresh := Evaluate(Stats{CreatedAt: FounderCutoff, OwnedServers: 0}, stored, now)
	dono := find(t, badges, "dono")
	if dono.Tier != 2 || dono.TierName != "Síndico" {
		t.Fatalf("dono = %+v, want tier 2 kept", dono)
	}
	for _, u := range fresh {
		if u.Category == "dono" {
			t.Fatalf("dono must not be unlocked again: %+v", u)
		}
	}
}

func TestEvaluateIgnoresUnknownStoredTiers(t *testing.T) {
	// Um tier removido do catálogo não pode quebrar a resposta.
	stored := Unlocks{"festeiro": {9: now}, "sumiu": {1: now}}
	badges, _ := Evaluate(Stats{CreatedAt: FounderCutoff}, stored, now)
	if hasBadge(badges, "festeiro") {
		t.Fatalf("tier que não existe mais não conta: %+v", badges)
	}
}

func TestRarityRankOrder(t *testing.T) {
	order := []string{RarityCommon, RarityRare, RarityEpic, RarityLegendary, RarityMythic}
	for i := 1; i < len(order); i++ {
		if rarityRank(order[i]) <= rarityRank(order[i-1]) {
			t.Fatalf("%s (%d) is not above %s (%d)", order[i], rarityRank(order[i]), order[i-1], rarityRank(order[i-1]))
		}
	}
	if rarityRank("desconhecida") != rarityRank(RarityCommon) {
		t.Fatal("unknown rarity should rank as common")
	}
}

func hasBadge(badges []Badge, key string) bool {
	for _, b := range badges {
		if b.Category == key {
			return true
		}
	}
	return false
}

func TestEvaluateCreatorIsOnlyForDevs(t *testing.T) {
	badges, fresh := Evaluate(Stats{CreatedAt: FounderCutoff}, nil, now)
	if hasBadge(badges, "criador") {
		t.Fatal("non-dev sees the Fundador (dev) badge")
	}
	for _, u := range fresh {
		if u.Category == "criador" {
			t.Fatalf("non-dev unlocked criador: %+v", u)
		}
	}

	badges, fresh = Evaluate(Stats{CreatedAt: FounderCutoff, IsDev: true}, nil, now)
	c := find(t, badges, "criador")
	if c.Tier != 1 || c.Rarity != RarityMythic || c.TierName != "Fundador" || c.Progress != 1 || c.NextThreshold != nil {
		t.Fatalf("dev criador = %+v", c)
	}
	if c.UnlockedAt == nil || !c.UnlockedAt.Equal(now) {
		t.Fatalf("dev criador unlocked_at = %v, want now", c.UnlockedAt)
	}
	var got bool
	for _, u := range fresh {
		got = got || (u.Category == "criador" && u.Tier == 1)
	}
	if !got {
		t.Fatalf("fresh = %+v, want criador/1", fresh)
	}
}

func TestEvaluateCreatorKeepsDateButNotAfterRevoke(t *testing.T) {
	granted := now.AddDate(0, -1, 0)
	stored := Unlocks{"criador": {1: granted}}

	badges, fresh := Evaluate(Stats{CreatedAt: FounderCutoff, IsDev: true}, stored, now)
	if c := find(t, badges, "criador"); c.UnlockedAt == nil || !c.UnlockedAt.Equal(granted) {
		t.Fatalf("criador unlocked_at = %v, want the stored %v", c.UnlockedAt, granted)
	}
	if len(fresh) != 0 {
		t.Fatalf("fresh = %+v, want nothing new", fresh)
	}

	// Saiu da tabela: o badge some, mesmo gravado.
	badges, _ = Evaluate(Stats{CreatedAt: FounderCutoff}, stored, now)
	if hasBadge(badges, "criador") {
		t.Fatal("revoked dev still has criador")
	}
}

func TestPublicViewOfCreatorHasNoNumbers(t *testing.T) {
	badges, _ := Evaluate(Stats{CreatedAt: FounderCutoff, IsDev: true}, nil, now)
	var pub *PublicBadge
	for _, b := range publicView(badges) {
		if b.Category == "criador" {
			b := b
			pub = &b
		}
	}
	if pub == nil || pub.Rarity != RarityMythic || pub.TierName != "Fundador" || pub.UnlockedAt == "" {
		t.Fatalf("public criador = %+v", pub)
	}
}

func TestEvaluateLOnlyForWhoSaidYes(t *testing.T) {
	badges, fresh := Evaluate(Stats{CreatedAt: FounderCutoff}, nil, now)
	if hasBadge(badges, "l") {
		t.Fatal("quem não fez o L vê o badge")
	}
	for _, u := range fresh {
		if u.Category == "l" {
			t.Fatalf("quem não fez o L desbloqueou: %+v", u)
		}
	}

	badges, fresh = Evaluate(Stats{CreatedAt: FounderCutoff, Escolhas: map[string]bool{"segundo-turno:l": true}}, nil, now)
	l := find(t, badges, "l")
	if l.Tier != 1 || l.TierName != "Fez o L" || l.Rarity != RarityEpic || l.Progress != 1 || l.NextThreshold != nil {
		t.Fatalf("badge l = %+v", l)
	}
	var got bool
	for _, u := range fresh {
		got = got || (u.Category == "l" && u.Tier == 1)
	}
	if !got {
		t.Fatalf("fresh = %+v, want l/1", fresh)
	}
}

func TestEvaluateLKeepsDateOnceStored(t *testing.T) {
	granted := now.AddDate(0, 0, -3)
	badges, fresh := Evaluate(Stats{CreatedAt: FounderCutoff, Escolhas: map[string]bool{"segundo-turno:l": true}}, Unlocks{"l": {1: granted}}, now)
	l := find(t, badges, "l")
	if l.UnlockedAt == nil || !l.UnlockedAt.Equal(granted) {
		t.Fatalf("unlocked_at = %v, want %v", l.UnlockedAt, granted)
	}
	for _, u := range fresh {
		if u.Category == "l" {
			t.Fatalf("já gravado, não pode vir de novo: %+v", u)
		}
	}
}

func TestEvaluateV22OnlyForWhoChoseIt(t *testing.T) {
	badges, fresh := Evaluate(Stats{CreatedAt: FounderCutoff, Escolhas: map[string]bool{"segundo-turno:l": true}}, nil, now)
	if hasBadge(badges, "v22") {
		t.Fatal("quem escolheu o L vê o badge do 22")
	}
	for _, u := range fresh {
		if u.Category == "v22" {
			t.Fatalf("quem escolheu o L desbloqueou o 22: %+v", u)
		}
	}

	badges, fresh = Evaluate(Stats{CreatedAt: FounderCutoff, Escolhas: map[string]bool{"segundo-turno:22": true}}, nil, now)
	b := find(t, badges, "v22")
	if b.Tier != 1 || b.TierName != "Fez o 22" || b.Rarity != RarityEpic || b.Progress != 1 || b.NextThreshold != nil {
		t.Fatalf("badge v22 = %+v", b)
	}
	if hasBadge(badges, "l") {
		t.Fatal("quem escolheu o 22 vê o badge do L")
	}
	var got bool
	for _, u := range fresh {
		got = got || (u.Category == "v22" && u.Tier == 1)
	}
	if !got {
		t.Fatalf("fresh = %+v, want v22/1", fresh)
	}
}

func TestEvaluateSpectatorFromWatchTime(t *testing.T) {
	badges, _ := Evaluate(Stats{CreatedAt: now, WatchSeconds: 12 * hour}, nil, now)
	b := find(t, badges, "espectador")
	if b.Unit != UnitSeconds || b.Value != 12*hour || b.Tier != 2 || b.TierName != "Pipoqueiro" {
		t.Fatalf("espectador = %+v, want 12h, tier 2 Pipoqueiro", b)
	}
	if b.NextThreshold == nil || *b.NextThreshold != 50*hour {
		t.Fatalf("espectador next = %v, want 50h", b.NextThreshold)
	}
	if last := b.Tiers[len(b.Tiers)-1]; last.Rarity != RarityLegendary {
		t.Fatalf("espectador top tier = %+v, want lendário", last)
	}
}

func TestEvaluateAccountAgeGoesUpToTenYears(t *testing.T) {
	// Os 5 primeiros tiers (1 a 24 meses) ficam como eram: ninguém perde nada.
	want := []string{"Semente", "Broto", "Muda", "Árvore", "Sequoia",
		"Bosque", "Floresta", "Jequitibá", "Baobá", "Árvore Ancestral", "Árvore Celestial", "Árvore da Vida", "Yggdrasil"}
	old, _ := Evaluate(Stats{CreatedAt: now.AddDate(-11, 0, 0)}, nil, now)
	conta := find(t, old, "conta")
	if len(conta.Tiers) != len(want) {
		t.Fatalf("conta tem %d tiers, want %d", len(conta.Tiers), len(want))
	}
	for i, name := range want {
		if conta.Tiers[i].Name != name {
			t.Fatalf("conta tier %d = %q, want %q", i+1, conta.Tiers[i].Name, name)
		}
	}
	if conta.Tiers[5].Threshold != 36 || conta.Tiers[12].Threshold != 120 || conta.Tiers[12].Rarity != RarityLegendary {
		t.Fatalf("3 anos/10 anos = %+v / %+v", conta.Tiers[5], conta.Tiers[12])
	}
	created := now.AddDate(-3, 0, -1)
	badges, fresh := Evaluate(Stats{CreatedAt: created}, nil, now)
	conta = find(t, badges, "conta")
	if conta.Tier != 6 || conta.NextAt == nil || !conta.NextAt.Equal(created.AddDate(0, 48, 0)) {
		t.Fatalf("3 anos = tier %d next_at %v, want 6 e o dia dos 4 anos", conta.Tier, conta.NextAt)
	}
	// O dia exato em que fez 3 anos.
	for _, u := range fresh {
		if u.Category == "conta" && u.Tier == 6 && !u.At.Equal(created.AddDate(0, 36, 0)) {
			t.Fatalf("conta/6 at %v", u.At)
		}
	}
}

func TestEscolhasSet(t *testing.T) {
	got := escolhasSet([]string{"segundo-turno:l", "outra:x"})
	if !got["segundo-turno:l"] || !got["outra:x"] || got["segundo-turno:22"] || len(got) != 2 {
		t.Fatalf("escolhasSet = %v", got)
	}
	if got := escolhasSet(nil); got == nil || len(got) != 0 {
		t.Fatalf("escolhasSet(nil) = %v, quer mapa vazio", got)
	}
}

func TestEvaluateFriendsFromAcceptedFriendships(t *testing.T) {
	badges, _ := Evaluate(Stats{CreatedAt: now, Friends: 16}, nil, now)
	b := find(t, badges, "amigos")
	if b.Unit != UnitFriends || b.Value != 16 || b.Tier != 2 || b.NextThreshold == nil || *b.NextThreshold != 30 {
		t.Fatalf("amigos = %+v, want 16 amigos, tier 2 e próximo em 30", b)
	}
	// Desfazer amizade não tira o tier já gravado (como todo badge).
	stored := Unlocks{"amigos": {1: now, 2: now}}
	badges, _ = Evaluate(Stats{CreatedAt: now, Friends: 3}, stored, now)
	if b := find(t, badges, "amigos"); b.Tier != 2 {
		t.Fatalf("amigos depois de desfazer = tier %d, want 2", b.Tier)
	}
}

func TestEvaluateBugHunterIsGrantedByTheTeam(t *testing.T) {
	// Sem linha em bug_hunters, nem aparece.
	badges, _ := Evaluate(Stats{CreatedAt: now}, nil, now)
	for _, b := range badges {
		if b.Category == "bugs" {
			t.Fatalf("bugs apareceu sem concessão: %+v", b)
		}
	}
	badges, _ = Evaluate(Stats{CreatedAt: now, BugsReported: 3}, nil, now)
	b := find(t, badges, "bugs")
	if b.Unit != UnitBugs || b.Tier != 2 || b.TierName != "Detetive" || b.NextThreshold == nil || *b.NextThreshold != 10 {
		t.Fatalf("bugs = %+v, want tier 2 Detetive e próximo em 10", b)
	}
}
