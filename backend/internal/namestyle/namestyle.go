// Package namestyle é o estilo do nome de exibição: fonte, efeito e cores.
// Os IDs daqui têm de ser os mesmos do app (frontend lib/nameStyle.ts; um teste
// de lá confere as duas listas).
package namestyle

import (
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strings"
)

var ErrInvalid = errors.New("estilo de nome inválido")

var Fonts = []string{
	"default", "tempo", "sakura", "jellybean", "modern", "medieval", "bit8", "vampyre",
	"handwritten", "slab", "condensed", "mono", "retro",
	"pixel", "terminal", "script", "elegant", "gothic", "space", "rounded", "soft",
	"marquee", "arcade", "disco", "cartoon", "scifi", "horror",
}

var Effects = []string{
	"solid", "gradient", "neon", "toon", "pop", "rainbow", "pulse",
	"flow", "glow", "glitch", "fire", "wave", "shimmer", "sparkle", "typewriter", "chrome", "shadow3d",
}

const maxColors = 2

// minColors: quantas cores o efeito exige. Os que não estão aqui não exigem.
var minColors = map[string]int{
	"gradient": 2, "neon": 1, "toon": 1, "pop": 1, "flow": 2, "glow": 1, "shadow3d": 2,
}

// colorLimit: efeitos que aceitam menos que maxColors (os de cores próprias,
// como arco-íris e fogo, não aceitam nenhuma).
var colorLimit = map[string]int{
	"solid": 1, "neon": 1, "toon": 1, "pop": 1, "pulse": 1, "glow": 1,
	"rainbow": 0, "fire": 0, "chrome": 0,
	"glitch": 1, "wave": 1, "shimmer": 1, "sparkle": 1, "typewriter": 1,
}

var colorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

type Style struct {
	Font   string   `json:"font"`
	Effect string   `json:"effect"`
	Colors []string `json:"colors"`
}

func Default() Style {
	return Style{Font: "default", Effect: "solid", Colors: []string{}}
}

func invalid(msg string) error {
	return fmt.Errorf("%w: %s", ErrInvalid, msg)
}

// Validate confere os IDs e as cores e devolve o estilo arrumado (cores em
// minúsculas, Colors nunca nil).
func Validate(s Style) (Style, error) {
	if !slices.Contains(Fonts, s.Font) {
		return Style{}, invalid("fonte desconhecida")
	}
	if !slices.Contains(Effects, s.Effect) {
		return Style{}, invalid("efeito desconhecido")
	}
	limit := maxColors
	if n, ok := colorLimit[s.Effect]; ok {
		limit = n
	}
	if len(s.Colors) > limit {
		return Style{}, invalid(fmt.Sprintf("o efeito escolhido aceita até %d cores", limit))
	}
	if len(s.Colors) < minColors[s.Effect] {
		return Style{}, invalid("o efeito escolhido precisa de mais cores")
	}
	out := Style{Font: s.Font, Effect: s.Effect, Colors: make([]string, 0, len(s.Colors))}
	for _, c := range s.Colors {
		if !colorPattern.MatchString(c) {
			return Style{}, invalid("cor inválida")
		}
		out.Colors = append(out.Colors, strings.ToLower(c))
	}
	return out, nil
}

// Expr é a expressão SQL que monta o JSON do estilo de quem está em `alias`
// (a tabela users). Escaneia direto num namestyle.Style.
func Expr(alias string) string {
	return fmt.Sprintf(
		`jsonb_build_object('font', %[1]s.name_font, 'effect', %[1]s.name_effect, 'colors', to_jsonb(%[1]s.name_colors))`,
		alias,
	)
}
