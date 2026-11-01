package profiletheme

import (
	"encoding/json"
	"errors"
	"strings"
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
		{"fundo pride sem cor", Theme{Border: "rainbow", Background: "pride", Effect: "confetti"}, true},
		{"fundo pride com cor", Theme{Border: "none", Background: "pride", BackgroundColors: []string{"#111111"}, Effect: "none"}, false},
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

func TestValidateNewEffects(t *testing.T) {
	for _, fx := range []string{"fire", "matrix", "glitch", "storm", "galaxy", "aurora", "hearts", "confetti", "synthwave", "rain"} {
		if _, err := Validate(Theme{Border: "none", Background: "default", Effect: fx}); err != nil {
			t.Fatalf("%s: %v", fx, err)
		}
	}
}

// Cliente antigo não manda os campos novos: zero vira o padrão, nunca erro.
func TestValidateExtrasDefaults(t *testing.T) {
	got, err := Validate(Theme{Border: "neon", BorderColors: []string{"#00ffaa"}, Background: "default", Effect: "snow"})
	if err != nil {
		t.Fatal(err)
	}
	if got.Extras != DefaultExtras() {
		t.Fatalf("extras = %+v, want %+v", got.Extras, DefaultExtras())
	}
	if Default().Extras != DefaultExtras() {
		t.Fatal("Default() sem os extras padrão")
	}
}

func TestValidateExtras(t *testing.T) {
	base := Theme{Border: "gradient", BorderColors: []string{"#111111", "#222222"}, Background: "gradient", BackgroundColors: []string{"#333333", "#444444"}, Effect: "fire"}
	with := func(e Extras) Theme { th := base; th.Extras = e; return th }
	cases := []struct {
		name string
		in   Extras
		ok   bool
	}{
		{"tudo preenchido", Extras{EffectColor: "#FF8800", EffectDensity: 100, EffectSpeed: 1, BorderAnimation: "spin", BorderWidth: 6, BackgroundAngle: 360, Texture: "grain"}, true},
		{"pulsar e pontos", Extras{BorderAnimation: "pulse", Texture: "dots"}, true},
		{"parada e linhas", Extras{BorderAnimation: "static", Texture: "lines"}, true},
		{"grade", Extras{Texture: "grid"}, true},
		{"cor do efeito inválida", Extras{EffectColor: "laranja"}, false},
		{"cor do efeito com css", Extras{EffectColor: "#000000;x"}, false},
		{"densidade acima", Extras{EffectDensity: 101}, false},
		{"densidade negativa", Extras{EffectDensity: -1}, false},
		{"velocidade acima", Extras{EffectSpeed: 500}, false},
		{"animação desconhecida", Extras{BorderAnimation: "wobble"}, false},
		{"borda grossa demais", Extras{BorderWidth: 7}, false},
		{"ângulo acima", Extras{BackgroundAngle: 361}, false},
		{"textura desconhecida", Extras{Texture: "marble"}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := Validate(with(tc.in))
			if tc.ok && err != nil {
				t.Fatalf("erro inesperado: %v", err)
			}
			if !tc.ok && !errors.Is(err, ErrInvalid) {
				t.Fatalf("err = %v, want ErrInvalid", err)
			}
		})
	}
	got, _ := Validate(with(Extras{EffectColor: "#FF8800", BackgroundAngle: 90}))
	if got.EffectColor != "#ff8800" || got.BackgroundAngle != 90 || got.EffectDensity != DefaultLevel || got.BorderAnimation != "default" || got.Texture != "none" {
		t.Fatalf("normalizado = %+v", got.Extras)
	}
}

func TestExtrasFilled(t *testing.T) {
	if (Extras{}).Filled() != DefaultExtras() {
		t.Fatal("vazio deveria virar o padrão")
	}
	if (Extras{Texture: "marble"}).Filled() != DefaultExtras() {
		t.Fatal("inválido salvo deveria virar o padrão")
	}
	if (Extras{EffectSpeed: 80}).Filled().EffectSpeed != 80 {
		t.Fatal("valor válido se perdeu")
	}
}

// O JSON é plano: os campos novos ficam ao lado dos antigos.
func TestThemeJSONFlat(t *testing.T) {
	b, err := json.Marshal(Default())
	if err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{`"effect":"none"`, `"effect_color":""`, `"effect_density":50`, `"effect_speed":50`, `"border_animation":"default"`, `"border_width":2`, `"background_angle":180`, `"texture":"none"`} {
		if !strings.Contains(string(b), key) {
			t.Fatalf("%s sem %s", b, key)
		}
	}
}
