package badge

import (
	"math"
	"time"

	"gin-quickstart/backend/internal/birthday"
	"gin-quickstart/backend/internal/level"
)

// Stats é tudo que os badges precisam saber de uma pessoa.
type Stats struct {
	CreatedAt    time.Time
	XP           int64
	VoiceSeconds int64
	MessagesSent int64
	// Mensagens distintas em que a pessoa reagiu (várias reações dela na
	// mesma mensagem contam 1).
	Reactions int64
	// Tempo compartilhando a tela numa call com mais gente.
	StreamSeconds int64
	// Tempo assistindo à transmissão de outra pessoa (sem estar surdo).
	WatchSeconds int64
	// Tempo em call (como no XP) entre 0h e 5h e entre 5h e 8h.
	NightSeconds   int64
	MorningSeconds int64
	// Mais gente numa call em que a pessoa estava.
	PeakCallSize int64
	// Maior tempo seguido numa call com mais alguém.
	LongestSessionSeconds int64
	// Servidores da pessoa com donoMinMembers membros além dela (Dono).
	OwnedServers int64
	// Amizades aceitas com conta real.
	Friends int64
	// Cards do quadro de propostas criados pela pessoa que ainda existem.
	Proposals int64
	// Está em dev_badge_users (Fundador).
	IsDev bool
	// Escolhas da enquete ("enquete:opcao"), de internal/enquete.
	Escolhas map[string]bool
	// Músicas do Maestro que tocaram 30 s com mais alguém ouvindo (DJ).
	SongsPlayed int64
	// Sons da mesa de áudio tocados com alguém ouvindo (Barulhento).
	SoundsPlayed int64
	// Mensagens com figurinha ou GIF (Figurinha).
	StickersSent int64
	// Dias seguidos usando o app: a sequência atual e a maior já feita.
	StreakDays        int64
	LongestStreakDays int64
	// Tempo em call com a câmera ligada e alguém ouvindo (Câmera ligada).
	CameraSeconds int64
	// Votos nos cards do quadro de propostas (Votante).
	Votes int64
	// Dia e mês do aniversário de quem deixa anunciar; 0 sem data.
	BirthdayDay   int64
	BirthdayMonth int64
	// Quando dia/mês do aniversário foram cadastrados ou trocados pela
	// última vez (anti-trapaça: precisa de birthdayGrace).
	BirthdaySetAt time.Time
	// Servidores em que a pessoa mandou a primeira mensagem.
	FirstMessages int64
	// Bugs reportados, concedidos à mão em bug_hunters (Caçador de bugs).
	BugsReported int64
	// Posição (1 a 10) no Top 10 do nível 100; 0 se não está.
	Top10Rank int64
	// As 10 vagas do Top 10 já foram dadas (Badges ocultos não conta o que
	// ninguém mais consegue).
	Top10Full bool
}

// Unlocks: categoria -> tier -> quando foi desbloqueado (o que está gravado).
type Unlocks map[string]map[int]time.Time

// Unlock é um tier recém-alcançado, para gravar.
type Unlock struct {
	Category string
	Tier     int
	At       time.Time
}

// TierInfo é um degrau da escada que o app mostra (conquistado ou próximo).
type TierInfo struct {
	Tier       int        `json:"tier"`
	Name       string     `json:"name"`
	Threshold  int64      `json:"threshold"`
	Rarity     string     `json:"rarity"`
	UnlockedAt *time.Time `json:"unlocked_at,omitempty"`
}

// Badge é uma categoria que a pessoa já conquistou (tier 1 ou mais) do jeito
// que o app mostra. Quem ainda não chegou ao tier 1 não recebe a categoria:
// ela fica escondida até a primeira conquista. Depois dela, o app mostra o
// que falta para o próximo tier.
type Badge struct {
	Category    string `json:"category"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Unit        string `json:"unit"`
	Value       int64  `json:"value"`
	Tier        int    `json:"tier"`
	TierName    string `json:"tier_name"`
	Rarity      string `json:"rarity"`
	// Quando o tier atual foi alcançado.
	UnlockedAt    *time.Time `json:"unlocked_at,omitempty"`
	NextThreshold *int64     `json:"next_threshold,omitempty"`
	NextTierName  string     `json:"next_tier_name,omitempty"`
	// Só na idade da conta: o dia em que o próximo tier chega.
	NextAt *time.Time `json:"next_at,omitempty"`
	// Do tier atual até o próximo, de 0 a 1 (1 no último tier).
	Progress float64 `json:"progress"`
	// A escada inteira: os conquistados com o dia e os próximos sem.
	Tiers []TierInfo `json:"tiers"`
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

// birthdayGrace: a data do aniversário precisa estar cadastrada há esse
// tempo para valer o badge (trocar a data para hoje não dá o badge).
const birthdayGrace = 30 * 24 * time.Hour

// isBirthday: hoje (Brasília) é o aniversário da pessoa, com a data
// cadastrada há pelo menos birthdayGrace.
func isBirthday(s Stats, now time.Time) bool {
	if s.BirthdayDay == 0 || s.BirthdayMonth == 0 || now.Sub(s.BirthdaySetAt) < birthdayGrace {
		return false
	}
	return birthday.IsBirthday(int(s.BirthdayDay), int(s.BirthdayMonth), now.In(Brasilia()))
}

func isFounder(createdAt time.Time) bool {
	return createdAt.Before(FounderCutoff)
}

// valueFn calcula o valor de uma categoria para uma pessoa.
type valueFn func(s Stats, now time.Time) int64

func flag(on bool) int64 {
	if on {
		return 1
	}
	return 0
}

// valueFns é o valor de cada categoria; categoria sem entrada vale 0.
var valueFns = map[string]valueFn{
	"voz":        func(s Stats, _ time.Time) int64 { return s.VoiceSeconds },
	"conta":      func(s Stats, now time.Time) int64 { return monthsBetween(s.CreatedAt, now) },
	"mensagens":  func(s Stats, _ time.Time) int64 { return s.MessagesSent },
	"streamer":   func(s Stats, _ time.Time) int64 { return s.StreamSeconds },
	"espectador": func(s Stats, _ time.Time) int64 { return s.WatchSeconds },
	"nivel": func(s Stats, _ time.Time) int64 {
		lvl, _, _ := level.FromXP(s.XP)
		return int64(lvl)
	},
	"coruja":       func(s Stats, _ time.Time) int64 { return s.NightSeconds },
	"madrugador":   func(s Stats, _ time.Time) int64 { return s.MorningSeconds },
	"fundador":     func(s Stats, _ time.Time) int64 { return flag(isFounder(s.CreatedAt)) },
	"dono":         func(s Stats, _ time.Time) int64 { return s.OwnedServers },
	"festeiro":     func(s Stats, _ time.Time) int64 { return s.PeakCallSize },
	"maratona":     func(s Stats, _ time.Time) int64 { return s.LongestSessionSeconds },
	"reacoes":      func(s Stats, _ time.Time) int64 { return s.Reactions },
	"amigos":       func(s Stats, _ time.Time) int64 { return s.Friends },
	"bugs":         func(s Stats, _ time.Time) int64 { return s.BugsReported },
	"top10":        func(s Stats, _ time.Time) int64 { return s.Top10Rank },
	"contribuinte": func(s Stats, _ time.Time) int64 { return s.Proposals },
	"criador":      func(s Stats, _ time.Time) int64 { return flag(s.IsDev) },
	"l":            func(s Stats, _ time.Time) int64 { return flag(s.Escolhas["segundo-turno:l"]) },
	"v22":          func(s Stats, _ time.Time) int64 { return flag(s.Escolhas["segundo-turno:22"]) },
	"nulo":         func(s Stats, _ time.Time) int64 { return flag(s.Escolhas["segundo-turno:nulo"]) },
	"dj":           func(s Stats, _ time.Time) int64 { return s.SongsPlayed },
	"barulhento":   func(s Stats, _ time.Time) int64 { return s.SoundsPlayed },
	"figurinha":    func(s Stats, _ time.Time) int64 { return s.StickersSent },
	"sequencia":    func(s Stats, _ time.Time) int64 { return s.LongestStreakDays },
	"camera":       func(s Stats, _ time.Time) int64 { return s.CameraSeconds },
	"votante":      func(s Stats, _ time.Time) int64 { return s.Votes },
	"primeira":     func(s Stats, _ time.Time) int64 { return s.FirstMessages },
	"aniversariante": func(s Stats, now time.Time) int64 {
		return flag(isBirthday(s, now))
	},
}

func valueOf(c Category, s Stats, now time.Time) int64 {
	if fn, ok := valueFns[c.Key]; ok {
		return fn(s, now)
	}
	return 0
}

// unlockTime é quando o tier foi alcançado. Na idade da conta e no Pioneiro
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

// ladder é a escada inteira de c: cada tier com o dia em que foi conquistado
// (gravado ou alcançado agora) e, separados, os que ainda precisam ser gravados.
// earned é o maior tier conquistado (0 se nenhum).
func ladder(c Category, value int64, saved map[int]time.Time, s Stats, now time.Time) (tiers []TierInfo, fresh []Unlock, earned int) {
	reached := tierFor(c, value)
	tiers = make([]TierInfo, len(c.Tiers))
	for i, t := range c.Tiers {
		n := i + 1
		info := TierInfo{Tier: n, Name: t.Name, Threshold: t.Threshold, Rarity: t.Rarity}
		if at, ok := saved[n]; ok {
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
	return tiers, fresh, earned
}

// progressTo preenche o que falta para o próximo tier (earned já é >= 1).
func progressTo(b *Badge, c Category, earned int, value int64, createdAt time.Time) {
	if earned >= len(c.Tiers) {
		b.Progress = 1
		return
	}
	floor := c.Tiers[earned-1].Threshold
	next := c.Tiers[earned]
	b.NextThreshold = &next.Threshold
	b.NextTierName = next.Name
	if span := next.Threshold - floor; span > 0 && value > floor {
		b.Progress = math.Min(1, float64(value-floor)/float64(span))
	}
	if c.Key == "conta" {
		at := createdAt.AddDate(0, int(next.Threshold), 0)
		b.NextAt = &at
	}
}

// evaluateCategory monta o badge de c para a pessoa; false quando ela ainda
// não tem nem o tier 1 (a categoria fica escondida até ser conquistada).
func evaluateCategory(c Category, s Stats, saved map[int]time.Time, now time.Time) (Badge, []Unlock, bool) {
	value := valueOf(c, s, now)
	// Concedido à mão: quem não tem nem vê; tirar da tabela tira o badge.
	if c.Exclusive && value == 0 {
		return Badge{}, nil, false
	}
	tiers, fresh, earned := ladder(c, value, saved, s, now)
	if earned == 0 {
		return Badge{}, nil, false
	}
	current := tiers[earned-1]
	b := Badge{
		Category:    c.Key,
		Name:        c.Name,
		Description: c.Description,
		Unit:        c.Unit,
		Value:       value,
		Tier:        earned,
		TierName:    current.Name,
		Rarity:      current.Rarity,
		UnlockedAt:  current.UnlockedAt,
		Tiers:       tiers,
	}
	progressTo(&b, c, earned, value, s.CreatedAt)
	return b, fresh, true
}

// Evaluate decide os badges de alguém: só as categorias em que ela já tem o
// tier 1. Um tier já gravado nunca se perde (o valor pode cair: servidor
// apagado, reação removida). Devolve também os tiers alcançados agora que
// ainda não estavam gravados.
func Evaluate(s Stats, stored Unlocks, now time.Time) ([]Badge, []Unlock) {
	badges := make([]Badge, 0, len(Catalog))
	var fresh []Unlock
	for _, c := range Catalog {
		b, unlocks, ok := evaluateCategory(c, s, stored[c.Key], now)
		if !ok {
			continue
		}
		badges = append(badges, b)
		fresh = append(fresh, unlocks...)
	}
	return badges, fresh
}
