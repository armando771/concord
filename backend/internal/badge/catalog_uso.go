package badge

// usoCategories: os badges de uso do app (Maestro, mesa de áudio,
// figurinhas, sequência de dias, câmera, votos, aniversário e primeira
// mensagem), depois dos outros na ordem do app.
var usoCategories = []Category{
	{
		// Músicas que a pessoa pediu ao Maestro (internal/music) e que tocaram
		// por 30 s, sem ser puladas, com mais alguém ouvindo na call: pôr na
		// fila não conta (music/played.go). Somadas a cada uma (Service.Count).
		Key:         "dj",
		Name:        "DJ",
		Description: "Peça músicas ao Maestro, o bot de música das calls. Conta a música que toca por pelo menos 30 segundos com mais alguém ouvindo.",
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
		// mensagens (migration 000114): a mesma figurinha ou GIF da mensagem
		// anterior da pessoa na sala, há menos de 1 hora, não conta, e a
		// apagada em até 2 minutos desconta.
		Key:         "figurinha",
		Name:        "Figurinha",
		Description: "Mande figurinhas e GIFs nos canais e nas DMs. A mesma figurinha ou GIF repetido em seguida não conta, e a apagada em até 2 minutos sai da conta.",
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
		// comemora em 28/02 no ano não bissexto. A data precisa estar
		// cadastrada há 30 dias (birthday_set_at). Depois do dia, fica.
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
