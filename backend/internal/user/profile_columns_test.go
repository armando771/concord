package user

import (
	"testing"

	"gin-quickstart/backend/internal/namestyle"
	"gin-quickstart/backend/internal/profiletheme"
)

func TestProfileColumnsNilViraNull(t *testing.T) {
	if styleFont(nil) != nil || styleEffect(nil) != nil || styleColors(nil) != nil {
		t.Fatal("estilo nil deveria virar NULL")
	}
	border := func(t *profiletheme.Theme) string { return t.Border }
	colors := func(t *profiletheme.Theme) []string { return t.BorderColors }
	if themeField(nil, border) != nil || themeColors(nil, colors) != nil || themeExtras(nil) != nil {
		t.Fatal("tema nil deveria virar NULL")
	}
}

func TestProfileColumnsComValor(t *testing.T) {
	s := &namestyle.Style{Font: "f", Effect: "e", Colors: []string{"#fff"}}
	if *styleFont(s) != "f" || *styleEffect(s) != "e" || styleColors(s)[0] != "#fff" {
		t.Fatal("estilo não passou os valores")
	}
	theme := &profiletheme.Theme{Border: "neon"}
	if *themeField(theme, func(t *profiletheme.Theme) string { return t.Border }) != "neon" {
		t.Fatal("campo do tema errado")
	}
	// Lista nil do tema grava '{}', nunca NULL.
	got := themeColors(theme, func(t *profiletheme.Theme) []string { return t.BorderColors })
	if got == nil || len(got) != 0 {
		t.Fatalf("cores = %#v, quer []string{}", got)
	}
	theme.BorderColors = []string{"#000"}
	if themeColors(theme, func(t *profiletheme.Theme) []string { return t.BorderColors })[0] != "#000" {
		t.Fatal("cores do tema erradas")
	}
}

func TestThemeExtrasColumn(t *testing.T) {
	theme := &profiletheme.Theme{Extras: profiletheme.Extras{Texture: "dots"}}
	if got := themeExtras(theme); got == nil || got.Texture != "dots" {
		t.Fatalf("extras = %+v", got)
	}
}
