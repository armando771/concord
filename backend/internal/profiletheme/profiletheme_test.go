package profiletheme

import (
	"errors"
	"testing"
)

func TestValidate(t *testing.T) {
	cases := []struct {
		name string
		in   Theme
		ok   bool
	}{
		{"padrão", Default(), true},
		{"sem listas (nil)", Theme{Border: "none", Background: "default", Effect: "none"}, true},
		{"borda sólida com cor", Theme{Border: "solid", BorderColors: []string{"#FF00AA"}, Background: "default", Effect: "none"}, true},
		{"borda sólida sem cor", Theme{Border: "solid", Background: "default", Effect: "none"}, false},
		{"neon com cor", Theme{Border: "neon", BorderColors: []string{"#00ffaa"}, Background: "default", Effect: "none"}, true},
		{"arco-íris sem cor", Theme{Border: "rainbow", Background: "default", Effect: "snow"}, true},
		{"arco-íris com cor", Theme{Border: "rainbow", BorderColors: []string{"#00ffaa"}, Background: "default", Effect: "none"}, false},
		{"borda degradê com uma cor", Theme{Border: "gradient", BorderColors: []string{"#00ffaa"}, Background: "default", Effect: "none"}, false},
		{"borda degradê com duas", Theme{Border: "gradient", BorderColors: []string{"#00ffaa", "#ff00aa"}, Background: "default", Effect: "none"}, true},
		{"fundo degradê com duas", Theme{Border: "none", Background: "gradient", BackgroundColors: []string{"#1e1b4b", "#0f172a"}, Effect: "sparkles"}, true},
		{"fundo degradê com três", Theme{Border: "none", Background: "gradient", BackgroundColors: []string{"#111111", "#222222", "#333333"}, Effect: "none"}, false},
		{"fundo padrão com cor", Theme{Border: "none", Background: "default", BackgroundColors: []string{"#111111"}, Effect: "none"}, false},
		{"fundo sólido", Theme{Border: "none", Background: "solid", BackgroundColors: []string{"#abcdef"}, Effect: "particles"}, true},
		{"borda inexistente", Theme{Border: "dotted", Background: "default", Effect: "none"}, false},
		{"fundo inexistente", Theme{Border: "none", Background: "image", Effect: "none"}, false},
		{"efeito inexistente", Theme{Border: "none", Background: "default", Effect: "fireworks"}, false},
		{"vazio", Theme{}, false},
		{"cor por nome", Theme{Border: "solid", BorderColors: []string{"red"}, Background: "default", Effect: "none"}, false},
		{"cor curta", Theme{Border: "solid", BorderColors: []string{"#fff"}, Background: "default", Effect: "none"}, false},
		{"css injetado", Theme{Border: "none", Background: "solid", BackgroundColors: []string{"#000000;background:url(x)"}, Effect: "none"}, false},
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
	got, err := Validate(Theme{Border: "gradient", BorderColors: []string{"#A1B2C3", "#FFFFFF"}, Background: "default", Effect: "none"})
	if err != nil || got.BorderColors[0] != "#a1b2c3" || got.BorderColors[1] != "#ffffff" {
		t.Fatalf("got %+v, err %v", got, err)
	}
	got, _ = Validate(Theme{Border: "none", Background: "default", Effect: "none"})
	if got.BorderColors == nil || got.BackgroundColors == nil {
		t.Fatal("as listas não podem ser nil (viram null no JSON)")
	}
}
