package badge

import (
	"time"

	"gin-quickstart/backend/internal/level"
)

// Stats é tudo que os badges precisam saber de uma pessoa.
type Stats struct {
	CreatedAt    time.Time
	XP           int64
	VoiceSeconds int64
	MessagesSent int64
	Reactions    int64
	// Tempo compartilhando a tela numa call com mais gente.
	StreamSeconds int64
	// Tempo em call (como no XP) entre 0h e 5h e entre 5h e 8h.
	NightSeconds   int64
	MorningSeconds int64
	// Mais gente numa call em que a pessoa estava.
	PeakCallSize int64
	// Maior tempo seguido numa call com mais alguém.
	LongestSessionSeconds int64
	OwnedServers          int64
}

// Unlocks: categoria -> tier -> quando foi desbloqueado (o que está gravado).
type Unlocks map[string]map[int]time.Time

// Unlock é um tier recém-alcançado, para gravar.
type Unlock struct {
	Category string
	Tier     int
	At       time.Time
}

// TierInfo é um degrau da escada que o app mostra.
type TierInfo struct {
	Tier       int        `json:"tier"`
	Name       string     `json:"name"`
	Threshold  int64      `json:"threshold"`
	Rarity     string     `json:"rarity"`
	UnlockedAt *time.Time `json:"unlocked_at,omitempty"`
}

// Badge é uma categoria do jeito que o app mostra. Tier 0 = nada ainda.
type Badge struct {
	Category    string `json:"category"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Unit        string `json:"unit"`
	Value       int64  `json:"value"`
	Tier        int    `json:"tier"`
	TierName    string `json:"tier_name,omitempty"`
	Rarity      string `json:"rarity,omitempty"`
	// Quando o tier atual foi alcançado.
	UnlockedAt    *time.Time `json:"unlocked_at,omitempty"`
	NextThreshold *int64     `json:"next_threshold,omitempty"`
	NextTierName  string     `json:"next_tier_name,omitempty"`
	// Só na idade da conta: o dia em que o próximo tier chega.
	NextAt *time.Time `json:"next_at,omitempty"`
	// Do tier atual até o próximo, de 0 a 1 (1 no último tier).
	Progress float64 `json:"progress"`
	// false quando não dá mais para conseguir (Fundador depois do corte).
	Obtainable bool       `json:"obtainable"`
	Tiers      []TierInfo `json:"tiers"`
}

// tierFor é o maior tier cujo limite o valor alcança (0 se nenhum).
func tierFor(c Category, value int64) int {
	tier := 0
	for i, t := range c.Tiers {
		if value >= t.Threshold {
			tier = i + 1
		}
	}
	return tier
}

// monthsBetween conta meses completos: `from` + n meses (AddDate) <= `to`.
func monthsBetween(from, to time.Time) int64 {
	if to.Before(from) {
		return 0
	}
	n := (to.Year()-from.Year())*12 + int(to.Month()) - int(from.Month())
	for n > 0 && from.AddDate(0, n, 0).After(to) {
		n--
	}
	return int64(n)
}

func isFounder(createdAt time.Time) bool {
	return createdAt.Before(FounderCutoff)
}

func valueOf(c Category, s Stats, now time.Time) int64 {
	switch c.Key {
	case "voz":
		return s.VoiceSeconds
	case "conta":
		return monthsBetween(s.CreatedAt, now)
	case "mensagens":
		return s.MessagesSent
	case "streamer":
		return s.StreamSeconds
	case "nivel":
		lvl, _, _ := level.FromXP(s.XP)
		return int64(lvl)
	case "coruja":
		return s.NightSeconds
	case "madrugador":
		return s.MorningSeconds
	case "fundador":
		if isFounder(s.CreatedAt) {
			return 1
		}
		return 0
	case "dono":
		return s.OwnedServers
	case "festeiro":
		return s.PeakCallSize
	case "maratona":
		return s.LongestSessionSeconds
	case "reacoes":
		return s.Reactions
	}
	return 0
}

// unlockTime é quando o tier foi alcançado. Na idade da conta e no Fundador
// dá para saber a data exata; no resto vale o momento em que o servidor viu.
func unlockTime(c Category, tier int, s Stats, now time.Time) time.Time {
	switch c.Key {
	case "conta":
		return s.CreatedAt.AddDate(0, int(c.Tiers[tier-1].Threshold), 0)
	case "fundador":
		return s.CreatedAt
	}
	return now
}

// Evaluate decide os badges de alguém. Um tier já gravado nunca se perde (o
// valor pode cair: servidor apagado, reação removida). Devolve também os
// tiers alcançados agora que ainda não estavam gravados.
func Evaluate(s Stats, stored Unlocks, now time.Time) ([]Badge, []Unlock) {
	badges := make([]Badge, 0, len(Catalog))
	var fresh []Unlock

	for _, c := range Catalog {
		value := valueOf(c, s, now)
		reached := tierFor(c, value)
		saved := stored[c.Key]

		tiers := make([]TierInfo, len(c.Tiers))
		earned := 0
		for i, t := range c.Tiers {
			n := i + 1
			info := TierInfo{Tier: n, Name: t.Name, Threshold: t.Threshold, Rarity: t.Rarity}
			if at, ok := saved[n]; ok {
				at := at
				info.UnlockedAt = &at
			} else if n <= reached {
				at := unlockTime(c, n, s, now)
				info.UnlockedAt = &at
				fresh = append(fresh, Unlock{Category: c.Key, Tier: n, At: at})
			}
			if info.UnlockedAt != nil {
				earned = n
			}
			tiers[i] = info
		}

		b := Badge{
			Category:    c.Key,
			Name:        c.Name,
			Description: c.Description,
			Unit:        c.Unit,
			Value:       value,
			Tier:        earned,
			Obtainable:  true,
			Tiers:       tiers,
		}
		if c.Key == "fundador" && earned == 0 && !isFounder(s.CreatedAt) {
			b.Obtainable = false
		}

		var floor int64
		if earned > 0 {
			current := tiers[earned-1]
			b.TierName = current.Name
			b.Rarity = current.Rarity
			b.UnlockedAt = current.UnlockedAt
			floor = current.Threshold
		}
		if earned < len(c.Tiers) {
			next := c.Tiers[earned]
			threshold := next.Threshold
			b.NextThreshold = &threshold
			b.NextTierName = next.Name
			if span := threshold - floor; span > 0 && value > floor {
				b.Progress = float64(value-floor) / float64(span)
				if b.Progress > 1 {
					b.Progress = 1
				}
			}
			if c.Key == "conta" {
				at := s.CreatedAt.AddDate(0, int(threshold), 0)
				b.NextAt = &at
			}
		} else {
			b.Progress = 1
		}
		badges = append(badges, b)
	}
	return badges, fresh
}
