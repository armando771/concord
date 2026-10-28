package music

// CommandSpec descreve um comando do Maestro: é a fonte única dos nomes que o
// ParseCommand reconhece e dos textos de ajuda (TextHelp e a lista fixada no
// canal #musica).
type CommandSpec struct {
	Kind Kind
	// Names: o primeiro é o nome principal; os outros são apelidos.
	Names []string
	// Usage: como se escreve o comando, com o argumento (ex.: "/play <link ou nome>").
	Usage string
	// Desc: o que ele faz, numa frase curta.
	Desc string
}

// commandSpecs lista todos os comandos do Maestro, na ordem em que aparecem na ajuda.
var commandSpecs = []CommandSpec{
	{Kind: KindPlay, Names: []string{"/play", "/p", "/tocar"}, Usage: "/play <link ou nome>", Desc: "toca ou põe na fila"},
	{Kind: KindSkip, Names: []string{"/skip", "/s", "/pular"}, Usage: "/skip", Desc: "pula (a sua música) ou vota (a dos outros)"},
	{Kind: KindQueue, Names: []string{"/fila", "/q"}, Usage: "/fila", Desc: "mostra a fila"},
	{Kind: KindHelp, Names: []string{"/help", "/ajuda", "/musica", "/música"}, Usage: "/help", Desc: "mostra os comandos"},
}

// Commands devolve a lista de comandos do Maestro (cópia, na ordem da ajuda).
func Commands() []CommandSpec {
	return append([]CommandSpec(nil), commandSpecs...)
}
