package badge

import "time"

// Raridade do tier: decide a cor e o selo na linha de estatística do app.
const (
	RarityCommon    = "comum"
	RarityRare      = "raro"
	RarityEpic      = "epico"
	RarityLegendary = "lendario"
	// Acima de lendário: só badges concedidos à mão (Fundador).
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
	UnitVote = "vote"
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

// Catalog é a lista de badges, na ordem em que o app mostra.
var Catalog = []Category{
	{
		Key:         "voz",
		Name:        "Tempo em call",
		Description: "Fique em call falando e ouvindo (sem mute e com mais alguém) para subir este badge.",
		Unit:        UnitSeconds,
		Tiers: []Tier{
			{"Ouvinte", 1 * hour, RarityCommon},
			{"Tagarela", 10 * hour, RarityCommon},
			{"Locutor", 50 * hour, RarityRare},
			{"Podcaster", 150 * hour, RarityEpic},
			{"Rádio 24h", 500 * hour, RarityEpic},
			{"Lenda da Call", 1000 * hour, RarityLegendary},
		},
	},
	{
		Key:         "conta",
		Name:        "Idade da conta",
		Description: "Continue com a sua conta no Salinha. O tempo faz o resto.",
		Unit:        UnitMonths,
		Tiers: []Tier{
			{"Semente", 1, RarityCommon},
			{"Broto", 3, RarityCommon},
			{"Muda", 6, RarityRare},
			{"Árvore", 12, RarityEpic},
			{"Sequoia", 24, RarityLegendary},
		},
	},
	{
		Key:         "mensagens",
		Name:        "Mensagens enviadas",
		Description: "Mande mensagens nos canais e nas DMs para subir este badge.",
		Unit:        UnitMessages,
		Tiers: []Tier{
			{"Puxa-assunto", 50, RarityCommon},
			{"Papo Reto", 500, RarityCommon},
			{"Fofoqueiro", 2000, RarityRare},
			{"Cronista", 10000, RarityEpic},
			{"Enciclopédia", 50000, RarityLegendary},
		},
	},
	{
		Key:         "streamer",
		Name:        "Streamer",
		Description: "Compartilhe a tela numa call com mais gente para subir este badge.",
		Unit:        UnitSeconds,
		Tiers: []Tier{
			{"Figurante", 1 * hour, RarityCommon},
			{"Apresentador", 10 * hour, RarityCommon},
			{"Streamer", 50 * hour, RarityRare},
			{"Diretor", 150 * hour, RarityEpic},
			{"Hollywood", 500 * hour, RarityLegendary},
		},
	},
	{
		Key:         "nivel",
		Name:        "Nível",
		Description: "Ganhe XP ficando em call para subir de nível e de badge.",
		Unit:        UnitLevel,
		Tiers: []Tier{
			{"Promessa", 10, RarityCommon},
			{"Veterano", 25, RarityRare},
			{"Mestre", 50, RarityEpic},
			{"Grão-Mestre", 75, RarityEpic},
			{"Imortal", 100, RarityLegendary},
		},
	},
	{
		Key:         "coruja",
		Name:        "Coruja",
		Description: "Fique em call entre meia-noite e 5h da manhã (horário do servidor).",
		Unit:        UnitSeconds,
		Tiers: []Tier{
			{"Insone", 1 * hour, RarityCommon},
			{"Notívago", 10 * hour, RarityRare},
			{"Coruja", 50 * hour, RarityEpic},
			{"Vampiro", 150 * hour, RarityLegendary},
		},
	},
	{
		Key:         "madrugador",
		Name:        "Madrugador",
		Description: "Fique em call entre 5h e 8h da manhã (horário do servidor).",
		Unit:        UnitSeconds,
		Tiers: []Tier{
			{"Despertador", 1 * hour, RarityCommon},
			{"Café Passado", 10 * hour, RarityRare},
			{"Galo", 50 * hour, RarityEpic},
			{"Sol Nascente", 150 * hour, RarityLegendary},
		},
	},
	{
		Key:         "criador",
		Name:        "Fundador",
		Description: "Um dos criadores da Salinha. Não dá para conquistar: é dos devs.",
		Unit:        UnitDev,
		Tiers: []Tier{
			{"Fundador", 1, RarityMythic},
		},
		Exclusive: true,
	},
	{
		Key:         "fundador",
		Name:        "Pioneiro",
		Description: "Entrou na Salinha nos primeiros dias, antes de 1º de novembro de 2026.",
		Unit:        UnitFounder,
		Tiers: []Tier{
			{"Pioneiro", 1, RarityLegendary},
		},
	},
	{
		// Quem respondeu "sim" ao banner do segundo turno (internal/segundoturno).
		// A resposta é única e fica em segundo_turno_respostas.
		Key:         "l",
		Name:        "Fez o L",
		Description: "Fez o L no segundo turno. Ganho respondendo ao banner.",
		Unit:        UnitVote,
		Tiers: []Tier{
			{"Fez o L", 1, RarityLegendary},
		},
		Exclusive: true,
	},
	{
		Key:         "dono",
		Name:        "Dono de servidor",
		Description: "Crie servidores e mantenha a turma reunida.",
		Unit:        UnitServers,
		Tiers: []Tier{
			{"Anfitrião", 1, RarityCommon},
			{"Síndico", 3, RarityRare},
			{"Magnata", 5, RarityEpic},
		},
	},
	{
		Key:         "festeiro",
		Name:        "Festeiro",
		Description: "Esteja numa call com muita gente ao mesmo tempo.",
		Unit:        UnitPeople,
		Tiers: []Tier{
			{"Rolê", 5, RarityCommon},
			{"Festa", 10, RarityRare},
			{"Carnaval", 20, RarityEpic},
		},
	},
	{
		Key:         "maratona",
		Name:        "Maratona",
		Description: "Fique numa mesma call com mais gente, sem sair, por horas seguidas.",
		Unit:        UnitSeconds,
		Tiers: []Tier{
			{"Fôlego", 2 * hour, RarityCommon},
			{"Maratonista", 5 * hour, RarityRare},
			{"Ultramaratona", 12 * hour, RarityEpic},
		},
	},
	{
		Key:         "reacoes",
		Name:        "Reações",
		Description: "Reaja às mensagens da galera com emojis.",
		Unit:        UnitReactions,
		Tiers: []Tier{
			{"Curtidor", 50, RarityCommon},
			{"Emotivo", 500, RarityRare},
			{"Emojista", 2000, RarityEpic},
		},
	},
	{
		// Conta os cards que a pessoa criou e que ainda estão no quadro,
		// inclusive os rejeitados (a ideia foi dada; ninguém perde por não ser
		// aprovada). Spam o time tech apaga, e card apagado sai da contagem; o
		// autor também só apaga em votação, então criar e apagar não sobe o
		// badge. Como todo badge, o tier já conquistado não se perde.
		Key:         "contribuinte",
		Name:        "Contribuinte",
		Description: "Crie cards no quadro de propostas de melhorias. Contam os que continuam no quadro, até os rejeitados.",
		Unit:        UnitProposals,
		Tiers: []Tier{
			{"Ideia", 1, RarityCommon},
			{"Colaborador", 5, RarityRare},
			{"Inovador", 15, RarityEpic},
			{"Visionário", 40, RarityEpic},
			{"Arquiteto", 100, RarityLegendary},
		},
	},
}
