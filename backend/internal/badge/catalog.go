package badge

import "time"

// Raridade do tier: decide a cor e o selo na linha de estatística do app.
const (
	RarityCommon    = "comum"
	RarityRare      = "raro"
	RarityEpic      = "epico"
	RarityLegendary = "lendario"
	// Acima de lendário, a mais rara: só badges exclusivos (Fundador, dos
	// devs, e o Top 10 do nível 100, que só dez pessoas vão ter).
	RarityMythic = "mitico"
)

// Unidade do valor de uma categoria (o app formata: horas, meses, ...).
const (
	UnitSeconds   = "seconds"
	UnitMonths    = "months"
	UnitMessages  = "messages"
	UnitReactions = "reactions"
	UnitLevel     = "level"
	UnitPeople    = "people"
	UnitServers   = "servers"
	UnitFounder   = "founder"
	UnitDev       = "dev"
	UnitProposals = "proposals"
	// UnitVote: badge de uma resposta única (o L do segundo turno).
	UnitVote    = "vote"
	UnitFriends = "friends"
	UnitBugs    = "bugs"
	// UnitRank: posição de chegada (Top 10 do nível 100).
	UnitRank = "rank"
	// UnitSongs: músicas do Maestro que tocaram de verdade (DJ).
	UnitSongs = "songs"
	// UnitSounds: sons tocados na mesa de áudio (Barulhento).
	UnitSounds = "sounds"
	// UnitStickers: figurinhas e GIFs enviados (Figurinha).
	UnitStickers = "stickers"
	// UnitDays: dias seguidos usando o app (Sequência).
	UnitDays = "days"
	// UnitVotes: votos no quadro de propostas (Votante).
	UnitVotes = "votes"
	// UnitBirthday: badge ganho no dia do aniversário (Aniversariante).
	UnitBirthday = "birthday"
	// UnitFirsts: servidores em que a pessoa mandou a primeira mensagem.
	UnitFirsts = "firsts"
)

// FounderCutoff: quem criou a conta antes desta data (horário de Brasília)
// ganha o badge Pioneiro. Depois dela ninguém mais consegue.
var FounderCutoff = time.Date(2026, 11, 1, 0, 0, 0, 0, time.FixedZone("BRT", -3*60*60))

// Tier é um degrau da categoria. Threshold está na unidade da categoria
// (segundos para tempo).
type Tier struct {
	Name      string
	Threshold int64
	Rarity    string
}

// Category é um badge com seus tiers, do mais fácil ao mais difícil.
type Category struct {
	Key         string
	Name        string
	Description string
	Unit        string
	Tiers       []Tier
	// Exclusive: vem de uma tabela no banco (concessão à mão ou resposta da
	// pessoa), não de um número. Só aparece para quem tem e some se a linha
	// for retirada, mesmo com o tier gravado em user_badges.
	Exclusive bool
}

const hour = int64(60 * 60)

// Catalog é a lista de badges, na ordem em que o app mostra: os do perfil e
// das calls (catalog_base.go) e depois os de uso do app (catalog_uso.go).
var Catalog = append(append([]Category{}, baseCategories...), usoCategories...)
