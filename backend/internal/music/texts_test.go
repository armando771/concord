package music

import "testing"

func TestFormatDuration(t *testing.T) {
	cases := map[int64]string{0: "0:00", 5_000: "0:05", 355_000: "5:55", 3_723_000: "1:02:03"}
	for ms, want := range cases {
		if got := FormatDuration(ms); got != want {
			t.Errorf("FormatDuration(%d) = %q, want %q", ms, got, want)
		}
	}
}

func TestFormatTotal(t *testing.T) {
	if got := FormatTotal(5_880_000); got != "1h 38min" {
		t.Errorf("got %q", got)
	}
	if got := FormatTotal(1_320_000); got != "22 min" {
		t.Errorf("got %q", got)
	}
	if got := FormatTotal(20_000); got != "1 min" {
		t.Errorf("got %q", got)
	}
}

func TestApprovedTexts(t *testing.T) {
	check := func(got, want string) {
		t.Helper()
		if got != want {
			t.Errorf("\n got: %q\nwant: %q", got, want)
		}
	}
	check(TextAdded("caio", "Bohemian Rhapsody", 355_000, "Sala 1", 2, 4),
		"🎵 @caio adicionou **Bohemian Rhapsody** (5:55) · 🔊 Sala 1 · posição 2 · toca em ~4 min")
	check(TextAddedNow("caio", "Bohemian Rhapsody", 355_000, "Sala 1"),
		"🎵 @caio adicionou **Bohemian Rhapsody** (5:55) · 🔊 Sala 1 · tocando agora")
	check(TextAddedPlaylist("caio", "Rock Anos 80", 23, 5_880_000, "Sala 1"),
		"🎵 @caio adicionou a playlist **Rock Anos 80** (23 músicas, ~1h 38min) · 🔊 Sala 1")
	check(TextNotInVoice, "🎧 Entre em um canal de voz primeiro, e aí é só chamar o Maestro!")
	check(TextQueueFull(100), "🚫 A fila lotou (100 músicas). Espere algumas tocarem e tente de novo.")
	check(TextFailed("Bohemian Rhapsody", "caio", "Sala 1"),
		"⚠️ **Bohemian Rhapsody** (pedido de @caio) não carregou e foi pulada · 🔊 Sala 1")
	check(TextCrashed("Sala 1"),
		"⚠️ O Maestro caiu da call por um erro. A fila foi perdida. Use /play para recomeçar. · 🔊 Sala 1")
	check(TextVoteCounted(2, 3), "Seu voto para pular foi registrado (2/3).")
	check(TextSkippedBy("Bohemian Rhapsody", "caio", "Sala 1"), "⏭️ **Bohemian Rhapsody** foi pulada por @caio · 🔊 Sala 1")
	check(TextSkippedByVote("Bohemian Rhapsody", 2, 3, "Sala 1"),
		"⏭️ **Bohemian Rhapsody** foi pulada por votação (2/3) · 🔊 Sala 1")
	check(TextAlreadyVoted(2, 3), "Calma! Você já votou (2/3).")
	check(TextSearchEmpty("lofi"), "😕 O YouTube não trouxe nada para \"lofi\".")
	check(TextVideoGone, "🚫 Esse vídeo foi removido ou não está disponível. Tente outro link.")
	check(TextPlaylistEmpty, "📀 Essa playlist está vazia, é privada ou só tem vídeos indisponíveis.")
	check(TextHelp, "🎻 Maestro\n/play <link ou nome>: toca ou põe na fila\n/skip: pula (a sua música) ou vota (a dos outros)\n/fila: mostra a fila\nEntre em um canal de voz antes. O Maestro sai sozinho depois de 5 min sem música.")
}

func TestTextQueue(t *testing.T) {
	got := TextQueue("Sala 1", "Bohemian Rhapsody", 130_000, 355_000, "caio",
		[]QueueLine{
			{Title: "Hotel California", DurationMs: 390_000, User: "ana", StartsInMs: 225_000},
			{Title: "Smells Like Teen Spirit", DurationMs: 301_000, User: "bia", StartsInMs: 600_000},
		}, 4, 1_320_000)
	want := "🎻 Fila do Maestro · 🔊 Sala 1\n\n" +
		"▶️ Tocando: Bohemian Rhapsody (2:10 / 5:55) · @caio\n\n" +
		"1. Hotel California (6:30) · @ana · em ~4 min\n" +
		"2. Smells Like Teen Spirit (5:01) · @bia · em ~10 min\n" +
		"… e mais 4 músicas (~22 min)"
	if got != want {
		t.Errorf("\n got: %q\nwant: %q", got, want)
	}
}
