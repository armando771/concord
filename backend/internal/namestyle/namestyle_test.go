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
		{"fonte inexistente", Style{Font: "comic", Effect: "solid"}, false},
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
