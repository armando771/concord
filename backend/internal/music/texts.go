package music

import (
	"fmt"
	"strings"
)

// Textos aprovados pelo usuário (spec, seção 7). Não alterar sem aprovação.
const (
	TextNotInVoice     = "🎧 Entre em um canal de voz primeiro, e aí é só chamar o Maestro!"
	TextNotYouTube     = "🤔 Esse link não é do YouTube. Mande um link do YouTube ou digite o nome da música."
	TextPrivate        = "🔒 Não consigo tocar esse vídeo: ele é privado ou tem restrição de idade."
	TextLive           = "📡 Esse link é de uma live, e o Maestro só toca vídeos gravados."
	TextTooLong        = "⏱️ Esse vídeo é longo demais (máximo de 3 horas). Escolha um mais curto."
	TextTooManyPlayers = "🎻 O Maestro está regendo em muitos canais agora. Tente daqui a pouco."
	TextUnavailable    = "🛠️ O Maestro está fora do ar agora. Tente mais tarde."
	TextBotRemoved     = "🔕 O dono do servidor removeu o Maestro. Só o dono pode trazê-lo de volta."
	TextNothingPlaying = "🤫 Nada tocando agora. Use /play para começar."
	TextVideoGone      = "🚫 Esse vídeo foi removido ou não está disponível. Tente outro link."
	TextPlaylistEmpty  = "📀 Essa playlist está vazia, é privada ou só tem vídeos indisponíveis."
)

func FormatDuration(ms int64) string {
	s := ms / 1000
	h, m, sec := s/3600, (s%3600)/60, s%60
	if h > 0 {
		return fmt.Sprintf("%d:%02d:%02d", h, m, sec)
	}
	return fmt.Sprintf("%d:%02d", m, sec)
}

// MinutesCeil arredonda para cima; nunca diz "0 min".
func MinutesCeil(ms int64) int {
	m := int((ms + 59_999) / 60_000)
	if m < 1 {
		return 1
	}
	return m
}

func FormatTotal(ms int64) string {
	m := MinutesCeil(ms)
	if m >= 60 {
		return fmt.Sprintf("%dh %dmin", m/60, m%60)
	}
	return fmt.Sprintf("%d min", m)
}

func TextAdded(user, title string, durMs int64, sala string, pos, minutes int) string {
	return fmt.Sprintf("🎵 @%s adicionou **%s** (%s) · 🔊 %s · posição %d · toca em ~%d min",
		user, title, FormatDuration(durMs), sala, pos, minutes)
}

func TextAddedNow(user, title string, durMs int64, sala string) string {
	return fmt.Sprintf("🎵 @%s adicionou **%s** (%s) · 🔊 %s · tocando agora", user, title, FormatDuration(durMs), sala)
}

func TextAddedPlaylist(user, name string, n int, totalMs int64, sala string) string {
	return fmt.Sprintf("🎵 @%s adicionou a playlist **%s** (%d músicas, ~%s) · 🔊 %s", user, name, n, FormatTotal(totalMs), sala)
}

func TextQueueFull(max int) string {
	return fmt.Sprintf("🚫 A fila lotou (%d músicas). Espere algumas tocarem e tente de novo.", max)
}

func TextFailed(title, user, sala string) string {
	return fmt.Sprintf("⚠️ **%s** (pedido de @%s) não carregou e foi pulada · 🔊 %s", title, user, sala)
}

func TextCrashed(sala string) string {
	return "⚠️ O Maestro caiu da call por um erro. A fila foi perdida. Use /play para recomeçar. · 🔊 " + sala
}

func TextVoteCounted(votes, needed int) string {
	return fmt.Sprintf("Seu voto para pular foi registrado (%d/%d).", votes, needed)
}

func TextSkippedBy(title, user, sala string) string {
	return fmt.Sprintf("⏭️ **%s** foi pulada por @%s · 🔊 %s", title, user, sala)
}

func TextSkippedByVote(title string, votes, needed int, sala string) string {
	return fmt.Sprintf("⏭️ **%s** foi pulada por votação (%d/%d) · 🔊 %s", title, votes, needed, sala)
}

func TextAlreadyVoted(votes, needed int) string {
	return fmt.Sprintf("Calma! Você já votou (%d/%d).", votes, needed)
}

func TextSearchEmpty(q string) string {
	return fmt.Sprintf("😕 O YouTube não trouxe nada para \"%s\".", q)
}

type QueueLine struct {
	Title      string
	DurationMs int64
	User       string
	StartsInMs int64
}

// TextQueue monta a resposta do /fila (T19): até 10 linhas + resumo do resto.
func TextQueue(sala, nowTitle string, elapsedMs, nowDurMs int64, nowUser string, next []QueueLine, moreCount int, moreTotalMs int64) string {
	var b strings.Builder
	fmt.Fprintf(&b, "🎻 Fila do Maestro · 🔊 %s\n\n", sala)
	fmt.Fprintf(&b, "▶️ Tocando: %s (%s / %s) · @%s", nowTitle, FormatDuration(elapsedMs), FormatDuration(nowDurMs), nowUser)
	if len(next) > 0 {
		b.WriteString("\n\n")
	}
	for i, l := range next {
		if i > 0 {
			b.WriteString("\n")
		}
		fmt.Fprintf(&b, "%d. %s (%s) · @%s · em ~%d min", i+1, l.Title, FormatDuration(l.DurationMs), l.User, MinutesCeil(l.StartsInMs))
	}
	if moreCount > 0 {
		fmt.Fprintf(&b, "\n… e mais %d músicas (~%s)", moreCount, FormatTotal(moreTotalMs))
	}
	return b.String()
}
