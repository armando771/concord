package namestyle

import (
	"errors"
	"strings"
	"testing"
)

func TestValidate(t *testing.T) {
	cases := []struct {
		name string
		in   Style
		ok   bool
	}{
		{"padrão", Style{Font: "default", Effect: "solid"}, true},
		{"fonte inexistente", Style{Font: "papyrus", Effect: "solid"}, false},
		{"efeito inexistente", Style{Font: "default", Effect: "blink"}, false},
		{"fonte vazia", Style{Font: "", Effect: "solid"}, false},
		{"sólido com uma cor", Style{Font: "tempo", Effect: "solid", Colors: []string{"#A1B2C3"}}, true},
		{"degradê com duas cores", Style{Font: "tempo", Effect: "gradient", Colors: []string{"#ff0000", "#0000ff"}}, true},
		{"degradê com uma cor", Style{Font: "tempo", Effect: "gradient", Colors: []string{"#ff0000"}}, false},
		{"neon sem cor", Style{Font: "tempo", Effect: "neon"}, false},
		{"arco-íris sem cor", Style{Font: "bit8", Effect: "rainbow"}, true},
		{"três cores", Style{Font: "tempo", Effect: "gradient", Colors: []string{"#111111", "#222222", "#333333"}}, false},
		{"cor por nome", Style{Font: "tempo", Effect: "solid", Colors: []string{"red"}}, false},
		{"cor curta", Style{Font: "tempo", Effect: "solid", Colors: []string{"#fff"}}, false},
		{"fonte nova (pixel)", Style{Font: "pixel", Effect: "solid"}, true},
		{"degradê animado com duas cores", Style{Font: "gothic", Effect: "flow", Colors: []string{"#ff0000", "#0000ff"}}, true},
		{"degradê animado com uma cor", Style{Font: "gothic", Effect: "flow", Colors: []string{"#ff0000"}}, false},
		{"neon pulsante sem cor", Style{Font: "default", Effect: "glow"}, false},
		{"fogo sem cor", Style{Font: "horror", Effect: "fire"}, true},
		{"fogo com cor", Style{Font: "horror", Effect: "fire", Colors: []string{"#ff0000"}}, false},
		{"cromado sem cor", Style{Font: "scifi", Effect: "chrome"}, true},
		{"sombra 3D com uma cor", Style{Font: "cartoon", Effect: "shadow3d", Colors: []string{"#ff0000"}}, false},
		{"sombra 3D com duas cores", Style{Font: "cartoon", Effect: "shadow3d", Colors: []string{"#ff0000", "#000000"}}, true},
		{"onda com uma cor", Style{Font: "rounded", Effect: "wave", Colors: []string{"#00ffaa"}}, true},
		{"glitch, brilho, brilhos e digitando sem cor", Style{Font: "terminal", Effect: "glitch"}, true},
		{"css injetado", Style{Font: "tempo", Effect: "solid", Colors: []string{"#ffffff;background:url(x)"}}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := Validate(tc.in)
			if tc.ok && err != nil {
				t.Fatalf("erro inesperado: %v", err)
			}
			if !tc.ok && !errors.Is(err, ErrInvalid) {
				t.Fatalf("err = %v, want ErrInvalid", err)
			}
		})
	}
}

func TestValidateNormalizes(t *testing.T) {
	got, err := Validate(Style{Font: "default", Effect: "solid", Colors: []string{"#A1B2C3"}})
	if err != nil || got.Colors[0] != "#a1b2c3" {
		t.Fatalf("got %+v, err %v", got, err)
	}
	got, _ = Validate(Style{Font: "default", Effect: "solid"})
	if got.Colors == nil {
		t.Fatal("Colors não pode ser nil (vira null no JSON)")
	}
}

func TestExpr(t *testing.T) {
	e := Expr("u")
	for _, want := range []string{"u.name_font", "u.name_effect", "u.name_colors"} {
		if !strings.Contains(e, want) {
			t.Fatalf("Expr(%q) = %s, falta %s", "u", e, want)
		}
	}
}

func TestNoColorEffectsRejectColors(t *testing.T) {
	for _, effect := range []string{"rainbow", "fire", "chrome"} {
		if _, err := Validate(Style{Font: "default", Effect: effect, Colors: []string{"#ffffff"}}); !errors.Is(err, ErrInvalid) {
			t.Fatalf("%s com cor: err = %v, want ErrInvalid", effect, err)
		}
	}
	for _, effect := range []string{"glitch", "shimmer", "sparkle", "typewriter"} {
		if _, err := Validate(Style{Font: "default", Effect: effect}); err != nil {
			t.Fatalf("%s sem cor: %v", effect, err)
		}
	}
}
