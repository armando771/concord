package user

import (
	"errors"
	"testing"
)

func TestCheckNameChars(t *testing.T) {
	ok := []string{
		"Ana",
		"Ana Souza",
		"João Ção",
		"🎮",
		"👨\U0000200d👩\U0000200d👧", // família: ZWJ entre emoji
		"🏳\U0000fe0f\U0000200d🌈",  // bandeira arco-íris: VS16 + ZWJ
		"👩🏽\U0000200d💻",           // tom de pele + ZWJ
		"❤\U0000fe0f",             // VS16 depois de símbolo
		"1\U0000fe0f\U000020e3",   // keycap
		"Zoë", "e\U00000301",      // acento combinado em cima de letra
		"李小龍", "Ελένη", "محمد",
		"ㅎㅎ", // letras coreanas de verdade
	}
	for _, name := range ok {
		if err := CheckNameChars(name); err != nil {
			t.Errorf("%q: err = %v, devia aceitar", name, err)
		}
	}

	invalid := map[string]string{
		"zero-width space":          "a\U0000200bb",
		"só zero-width":             "\U0000200b",
		"zero-width non-joiner":     "a\U0000200cb",
		"word joiner":               "a\U00002060b",
		"BOM":                       "\U0000feffAna",
		"soft hyphen":               "a\U000000adb",
		"RLO (bidi override)":       "a\U0000202eb",
		"LRE":                       "\U0000202aAna",
		"PDF":                       "Ana\U0000202c",
		"RLI (bidi isolate)":        "a\U00002067b",
		"PDI":                       "a\U00002069b",
		"arabic letter mark":        "a\U0000061cb",
		"NUL":                       "a\x00b",
		"só NUL":                    "\x00",
		"quebra de linha":           "a\nb",
		"tab":                       "a\tb",
		"DEL":                       "a\x7fb",
		"C1 control":                "a\U00000085b",
		"line separator":            "a\U00002028b",
		"replacement char":          "a\U0000fffdb",
		"hangul filler":             "\U00003164",
		"hangul filler no meio":     "a\U00003164b",
		"hangul choseong filler":    "\U0000115f",
		"hangul jungseong filler":   "\U00001160",
		"halfwidth hangul filler":   "\U0000ffa0",
		"braille em branco":         "\U00002800",
		"ZWJ solto entre letras":    "a\U0000200db",
		"ZWJ no começo":             "\U0000200d🎮",
		"VS16 depois de letra":      "a\U0000fe0f",
		"combining grapheme joiner": "a\U0000034fb",
	}
	for desc, name := range invalid {
		if err := CheckNameChars(name); !errors.Is(err, ErrNameInvalidChars) {
			t.Errorf("%s (%q): err = %v, want ErrNameInvalidChars", desc, name, err)
		}
	}

	// Sem nenhum caractere visível (só marcas combinantes ou espaço).
	for _, name := range []string{"\U00000301", "\U00000301\U00000302", "\U000000a0", " \U00003000 "} {
		if err := CheckNameChars(name); !errors.Is(err, ErrNameBlank) {
			t.Errorf("%q: err = %v, want ErrNameBlank", name, err)
		}
	}
}
