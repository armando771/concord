package serverlevel

// Fontes de XP do servidor (docs/adr/0016-nivel-do-servidor.md). Membro novo,
// mensagens, figurinhas e sons são contados por trigger no banco (migration
// 000150); as de tempo, por este pacote olhando as calls.
const (
	SourceMembers  = "membros"
	SourceMessages = "mensagens"
	SourceStickers = "figurinhas"
	SourceSounds   = "sons"
	SourceVoice    = "voz"
	SourceStream   = "live"
	SourceWatch    = "espectador"
	SourcePresence = "presenca"
)

// Sources: todas as fontes, na ordem do detalhamento.
var Sources = []string{
	SourceMembers, SourceMessages, SourceStickers, SourceSounds,
	SourceVoice, SourceStream, SourceWatch, SourcePresence,
}

// xpPerMinute: XP por minuto completo das fontes de tempo. O teto diário de
// cada fonte fica no banco (server_level_cap), onde toda soma passa.
var xpPerMinute = map[string]int64{
	SourceVoice:    1,
	SourceStream:   1,
	SourceWatch:    1,
	SourcePresence: 1,
}

// presenceMin: pessoas ativas (ouvindo, sem AFK, contas reais) para a call
// contar como cheia e render o bônus de presença.
const presenceMin = 3
