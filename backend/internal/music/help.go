package music

import "strings"

// CommandsKind marca a mensagem fixada no canal #musica com a lista de
// comandos (o app a mostra como mensagem do Maestro).
const CommandsKind = "music_commands"

const (
	helpFooter     = "Entre em um canal de voz antes. O Maestro sai sozinho depois de 5 min sem música."
	commandsIntro  = "🎻 **Comandos do Maestro**\nEntre em um canal de voz e escreva estes comandos no chat:"
	commandsFooter = "O Maestro sai sozinho depois de 5 min sem música."
)

// TextHelp é a resposta privada ao /help: um comando por linha (sem o próprio /help).
var TextHelp = buildHelp(commandSpecs)

func buildHelp(specs []CommandSpec) string {
	var b strings.Builder
	b.WriteString("🎻 Maestro\n")
	for _, spec := range specs {
		if spec.Kind == KindHelp {
			continue
		}
		b.WriteString(spec.Usage + ": " + spec.Desc + "\n")
	}
	b.WriteString(helpFooter)
	return b.String()
}

// TextCommands é a mensagem fixada no #musica: todos os comandos, com apelidos.
func TextCommands() string { return buildCommands(commandSpecs) }

func buildCommands(specs []CommandSpec) string {
	var b strings.Builder
	b.WriteString(commandsIntro + "\n")
	for _, spec := range specs {
		b.WriteString("\n" + spec.Usage + aliasesOf(spec) + ": " + spec.Desc)
	}
	b.WriteString("\n\n" + commandsFooter)
	return b.String()
}

// aliasesOf devolve " (ou /p, /tocar)" com os apelidos do comando, ou "".
func aliasesOf(spec CommandSpec) string {
	if len(spec.Names) < 2 {
		return ""
	}
	return " (ou " + strings.Join(spec.Names[1:], ", ") + ")"
}
