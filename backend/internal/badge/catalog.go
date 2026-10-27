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
	// UnitSongs: músicas postas na fila do Maestro (DJ).
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

// Catalog é a lista de badges, na ordem em que o app mostra.
var Catalog = []Category{
	{
		// Os 10 primeiros a chegar no nível 100, na ordem em badge_top10
		// (ver top10.go). O valor é a posição (1 a 10). Primeiro do catálogo:
		// entre os míticos, é o que aparece na frente.
		Key:         "top10",
		Name:        "Top 10 do Nível 100",
		Description: "Um dos 10 primeiros a chegar no nível 100. Só 10 pessoas no Salinha vão ter este badge.",
		Unit:        UnitRank,
		Tiers: []Tier{
			{"Panteão", 1, RarityMythic},
		},
		Exclusive: true,
	},
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
			// De 3 a 10 anos. Acima de lendário só há mítico, que é dos
			// exclusivos: a raridade fica no topo e a arte é que cresce.
			{"Bosque", 36, RarityLegendary},
			{"Floresta", 48, RarityLegendary},
			{"Jequitibá", 60, RarityLegendary},
			{"Baobá", 72, RarityLegendary},
			{"Árvore Ancestral", 84, RarityLegendary},
			{"Árvore Celestial", 96, RarityLegendary},
			{"Árvore da Vida", 108, RarityLegendary},
			{"Yggdrasil", 120, RarityLegendary},
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
		// Conta quem assiste à live de outra pessoa na call, sem estar surdo.
		// Ver duas lives ao mesmo tempo conta uma vez; a própria não conta.
		Key:         "espectador",
		Name:        "Espectador",
		Description: "Assista à transmissão de tela de outra pessoa numa call para subir este badge.",
		Unit:        UnitSeconds,
		Tiers: []Tier{
			{"Curioso", 1 * hour, RarityCommon},
			{"Pipoqueiro", 10 * hour, RarityCommon},
			{"Cinéfilo", 50 * hour, RarityRare},
			{"Crítico", 150 * hour, RarityEpic},
			{"Camarote", 500 * hour, RarityLegendary},
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
		// O time concede à mão em bug_hunters (SQL em docs/HOSPEDAGEM.md),
		// somando os bugs reportados. Como o Fundador, some se a linha sair.
		Key:         "bugs",
		Name:        "Caçador de bugs",
		Description: "Reporte bugs para o time do Salinha. Concedido pelo time a cada bug confirmado.",
		Unit:        UnitBugs,
		Tiers: []Tier{
			{"Olho Vivo", 1, RarityCommon},
			{"Detetive", 3, RarityRare},
			{"Exterminador", 10, RarityEpic},
			{"Lenda do QA", 25, RarityLegendary},
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
		// Amizades aceitas agora. Aceitar reavalia na hora (AcceptHook da
		// amizade); desfazer não tira o tier já conquistado.
		Key:         "amigos",
		Name:        "Amigos",
		Description: "Faça amizades no Salinha. Contam os pedidos de amizade aceitos.",
		Unit:        UnitFriends,
		Tiers: []Tier{
			{"Enturmado", 5, RarityCommon},
			{"Popular", 15, RarityCommon},
			{"Galera Toda", 30, RarityRare},
			{"Celebridade", 50, RarityEpic},
			{"Prefeito da Salinha", 100, RarityLegendary},
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
	{
		// Músicas que a pessoa pôs na fila do Maestro (internal/music); a
		// playlist conta cada música que entrou. Somadas pelo backend a cada
		// pedido (Service.Count).
		Key:         "dj",
		Name:        "DJ",
		Description: "Ponha músicas na fila do Maestro, o bot de música das calls.",
		Unit:        UnitSongs,
		Tiers: []Tier{
			{"Pede Música", 10, RarityCommon},
			{"Dono da Playlist", 50, RarityCommon},
			{"DJ de Churrasco", 200, RarityRare},
			{"DJ Residente", 1000, RarityEpic},
			{"Lenda das Pick-ups", 5000, RarityLegendary},
		},
	},
	{
		// Sons tocados na mesa de áudio (soundboard) de uma call com alguém
		// ouvindo. Somados pelo backend a cada som (Service.Count).
		Key:         "barulhento",
		Name:        "Barulhento",
		Description: "Toque sons da mesa de áudio numa call com mais gente ouvindo.",
		Unit:        UnitSounds,
		Tiers: []Tier{
			{"Buzina", 25, RarityCommon},
			{"Fanfarrão", 250, RarityRare},
			{"Trio Elétrico", 1000, RarityEpic},
			{"Caixa de Som do Vizinho", 5000, RarityLegendary},
		},
	},
	{
		// Mensagens com figurinha ou GIF, contadas por trigger como as
		// mensagens (mensagem apagada não desconta).
		Key:         "figurinha",
		Name:        "Figurinha",
		Description: "Mande figurinhas e GIFs nos canais e nas DMs.",
		Unit:        UnitStickers,
		Tiers: []Tier{
			{"Figurinha Repetida", 10, RarityCommon},
			{"Colecionador", 100, RarityRare},
			{"Álbum da Copa", 500, RarityEpic},
			{"Rei do GIF", 2000, RarityLegendary},
		},
	},
	{
		// Dias seguidos com o app aberto (horário de Brasília), como a
		// ofensiva do Duolingo. O tier vem da maior sequência já feita: perder
		// a sequência não tira o que foi conquistado.
		Key:         "sequencia",
		Name:        "Sequência",
		Description: "Abra o Salinha todo dia, sem pular nenhum (horário de Brasília). Vale a sua maior sequência.",
		Unit:        UnitDays,
		Tiers: []Tier{
			{"Faísca", 3, RarityCommon},
			{"Foguinho", 7, RarityCommon},
			{"Fogueira", 30, RarityRare},
			{"Incêndio", 100, RarityEpic},
			{"Chama Eterna", 365, RarityLegendary},
		},
	},
	{
		// Tempo em call com a câmera ligada, com as regras do Streamer: na
		// call com mais alguém ouvindo. Quem está de câmera vem do LiveKit
		// (Service.WithCameras).
		Key:         "camera",
		Name:        "Câmera ligada",
		Description: "Fique em call com a câmera ligada e mais gente ouvindo.",
		Unit:        UnitSeconds,
		Tiers: []Tier{
			{"Rostinho", 1 * hour, RarityCommon},
			{"Ao Vivo", 10 * hour, RarityCommon},
			{"Galã", 50 * hour, RarityRare},
			{"Influencer", 150 * hour, RarityEpic},
			{"Big Brother", 500 * hour, RarityLegendary},
		},
	},
	{
		// Votos dados nos cards do quadro de propostas (o Contribuinte conta
		// quem cria). Trocar o voto não conta de novo; voto retirado ou card
		// apagado sai da contagem, mas o tier conquistado fica.
		Key:         "votante",
		Name:        "Votante",
		Description: "Vote nos cards do quadro de propostas de melhorias.",
		Unit:        UnitVotes,
		Tiers: []Tier{
			{"Eleitor", 1, RarityCommon},
			{"Cidadão", 10, RarityCommon},
			{"Fiscal de Urna", 30, RarityRare},
			{"Mesário", 75, RarityEpic},
			{"Voto de Minerva", 150, RarityLegendary},
		},
	},
	{
		// Ganho no dia do aniversário (Brasília), com as regras do recado de
		// aniversário (internal/birthday): só quem deixa anunciar, e 29/02
		// comemora em 28/02 no ano não bissexto. Depois do dia, fica.
		Key:         "aniversariante",
		Name:        "Aniversariante",
		Description: "Ganhe no dia do seu aniversário. Cadastre a data em Configurações e deixe ligado anunciar o aniversário nos servidores.",
		Unit:        UnitBirthday,
		Tiers: []Tier{
			{"Aniversariante", 1, RarityCommon},
		},
	},
	{
		// Quem mandou a primeira mensagem de um servidor (server_first_messages,
		// gravada por trigger; os servidores antigos vieram do histórico).
		// Exclusivo: só aparece para quem foi a primeira em algum.
		Key:         "primeira",
		Name:        "Primeira mensagem",
		Description: "Mande a primeira mensagem de um servidor, antes de todo mundo.",
		Unit:        UnitFirsts,
		Tiers: []Tier{
			{"Quebra-gelo", 1, RarityRare},
			{"Desbravador", 3, RarityEpic},
			{"Big Bang", 10, RarityLegendary},
		},
		Exclusive: true,
	},
}
