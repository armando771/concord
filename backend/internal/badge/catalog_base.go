package badge

// baseCategories: os badges do perfil, das calls e os concedidos à mão, na
// ordem em que o app mostra (o Top 10 primeiro).
var baseCategories = []Category{
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
		// Contadas por trigger (migration 000113): a mensagem igual à anterior
		// da pessoa na sala, há menos de 1 hora, não conta, e a apagada em até
		// 2 minutos desconta.
		Key:         "mensagens",
		Name:        "Mensagens enviadas",
		Description: "Mande mensagens nos canais e nas DMs para subir este badge. Mensagem repetida em seguida não conta, e a apagada em até 2 minutos sai da conta.",
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
		// Quem escolheu "Fez o L" na enquete do segundo turno (internal/enquete).
		Key:         "l",
		Name:        "Fez o L",
		Description: "Fez o L no segundo turno. Ganho escolhendo o badge do segundo turno.",
		Unit:        UnitVote,
		Tiers: []Tier{
			{"Fez o L", 1, RarityEpic},
		},
		Exclusive: true,
	},
	{
		// Quem escolheu "Fez o 22" na enquete do segundo turno
		// (internal/enquete), com o mesmo peso dos badges l e nulo.
		Key:         "v22",
		Name:        "Fez o 22",
		Description: "Fez o 22 no segundo turno. Ganho escolhendo o badge do segundo turno.",
		Unit:        UnitVote,
		Tiers: []Tier{
			{"Fez o 22", 1, RarityEpic},
		},
		Exclusive: true,
	},
	{
		// Quem escolheu "Nulo" na enquete do segundo turno (internal/enquete),
		// com o mesmo peso dos badges l e v22.
		Key:         "nulo",
		Name:        "Votou Nulo",
		Description: "Anulou o voto no segundo turno. Ganho escolhendo o badge do segundo turno.",
		Unit:        UnitVote,
		Tiers: []Tier{
			{"Votou Nulo", 1, RarityEpic},
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
		// Servidores criados com pelo menos 3 membros além do dono (bots não
		// contam; donoMinMembers em repository.go). Criar servidores vazios
		// em série não sobe o badge.
		Key:         "dono",
		Name:        "Dono de servidor",
		Description: "Crie servidores e reúna a turma. Conta o servidor com pelo menos 3 membros além de você.",
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
		// Amizades aceitas agora com conta real: e-mail confirmado e não bot.
		// Aceitar reavalia na hora (AcceptHook da amizade); o amigo que vira conta real depois entra na próxima
		// avaliação (varredura dos online ou perfil aberto), sem custo extra.
		// Desfazer não tira o tier já conquistado.
		Key:         "amigos",
		Name:        "Amigos",
		Description: "Faça amizades no Salinha. Contam os pedidos de amizade aceitos com contas de e-mail confirmado.",
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
		Description: "Reaja às mensagens da galera com emojis. Cada mensagem conta uma vez, mesmo com vários emojis.",
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
