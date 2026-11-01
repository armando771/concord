package music

import (
	"strings"
	"testing"
)

func TestTextCommandsListaTodosOsComandos(t *testing.T) {
	want := "🎻 **Comandos do Maestro**\n" +
		"Entre em um canal de voz e escreva estes comandos no chat:\n\n" +
		"/play <link ou nome> (ou /p, /tocar): toca ou põe na fila\n" +
		"/skip (ou /s, /pular): pula (a sua música) ou vota (a dos outros)\n" +
		"/fila (ou /q): mostra a fila\n" +
		"/help (ou /ajuda, /musica, /música): mostra os comandos\n\n" +
		"O Maestro sai sozinho depois de 5 min sem música."
	if got := TextCommands(); got != want {
		t.Errorf("\n got: %q\nwant: %q", got, want)
	}
}

// Todo nome que o ParseCommand reconhece tem que aparecer na lista fixada: se
// alguém criar um comando em commandNames sem passar por commandSpecs, quebra.
func TestTextCommandsCobreTodosOsNomesReconhecidos(t *testing.T) {
	text := TextCommands()
	for name := range commandNames {
		if !strings.Contains(text, name) {
			t.Errorf("comando %q reconhecido mas ausente da lista de comandos", name)
		}
	}
}

func TestCommandsDevolveCopia(t *testing.T) {
	list := Commands()
	if len(list) != len(commandSpecs) {
		t.Fatalf("len = %d, want %d", len(list), len(commandSpecs))
	}
	list[0].Usage = "mexido"
	if commandSpecs[0].Usage == "mexido" {
		t.Error("Commands() expôs a lista interna")
	}
}
