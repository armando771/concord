package badge

import "time"

// PublicTier é um degrau da escada visto por outra pessoa: o catálogo e, se
// conquistado, só o dia.
type PublicTier struct {
	Tier      int    `json:"tier"`
	Name      string `json:"name"`
	Threshold int64  `json:"threshold"`
	Rarity    string `json:"rarity"`
	// "2006-01-02" em Brasília; vazio se ainda não conquistado.
	UnlockedAt string `json:"unlocked_at,omitempty"`
}

// PublicBadge é um badge conquistado visto por outra pessoa. Sem o número
// exato (mensagens, segundos em call de madrugada, servidores), sem
// progresso e sem horário: contadores ao vivo diriam o que a pessoa está
// fazendo agora, mesmo invisível.
type PublicBadge struct {
	Category    string       `json:"category"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Unit        string       `json:"unit"`
	Tier        int          `json:"tier"`
	TierName    string       `json:"tier_name"`
	Rarity      string       `json:"rarity"`
	UnlockedAt  string       `json:"unlocked_at"`
	Tiers       []PublicTier `json:"tiers"`
	// Só no Top 10 do nível 100: a posição de chegada não muda nem diz o que
	// a pessoa está fazendo, então aparece para todos.
	Value int64 `json:"value,omitempty"`
}

func day(at *time.Time) string {
	if at == nil {
		return ""
	}
	return at.In(Brasilia()).Format("2006-01-02")
}

func publicValue(b Badge) int64 {
	if b.Unit == UnitRank {
		return b.Value
	}
	return 0
}

// publicView tira dos badges tudo que não é "o que conquistou e quando".
func publicView(badges []Badge) []PublicBadge {
	out := make([]PublicBadge, 0, len(badges))
	for _, b := range badges {
		if b.Tier == 0 {
			continue
		}
		tiers := make([]PublicTier, len(b.Tiers))
		for i, t := range b.Tiers {
			tiers[i] = PublicTier{Tier: t.Tier, Name: t.Name, Threshold: t.Threshold, Rarity: t.Rarity, UnlockedAt: day(t.UnlockedAt)}
		}
		out = append(out, PublicBadge{
			Category:    b.Category,
			Name:        b.Name,
			Description: b.Description,
			Unit:        b.Unit,
			Tier:        b.Tier,
			TierName:    b.TierName,
			Rarity:      b.Rarity,
			UnlockedAt:  day(b.UnlockedAt),
			Tiers:       tiers,
			Value:       publicValue(b),
		})
	}
	return out
}
