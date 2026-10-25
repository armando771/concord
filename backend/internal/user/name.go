package user

import (
	"errors"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Regras de caracteres para nomes que os outros veem (nome de exibição e
// apelido no servidor). O app tem a mesma regra em lib/nameChars.ts.

var (
	// ErrNameEmpty: vazio depois de tirar os espaços das pontas.
	ErrNameEmpty = errors.New("o nome não pode ficar vazio")
	// ErrNameTooLong: mais caracteres que o limite (conta caractere, não byte).
	ErrNameTooLong = errors.New("o nome é longo demais")
	// ErrNameInvalidChars: caractere de controle (inclusive NUL e quebra de
	// linha), invisível (zero-width, preenchimento hangul, braille em branco)
	// ou que inverte o texto (bidi). Servem para sumir com o nome ou se passar
	// por outra pessoa.
	ErrNameInvalidChars = errors.New("o nome tem caracteres invisíveis ou de controle")
	// ErrNameBlank: só espaço ou marca combinante, nada que apareça.
	ErrNameBlank = errors.New("o nome precisa ter algum caractere visível")
)

const (
	zeroWidthJoiner     = 0x200D
	variationSelector16 = 0xFE0F
	replacementChar     = 0xFFFD
)

// Letras e símbolos que aparecem em branco.
var invisibleRunes = map[rune]bool{
	0x034F: true, // combining grapheme joiner
	0x115F: true, // hangul choseong filler
	0x1160: true, // hangul jungseong filler
	0x17B4: true, // khmer vowel inherent aq
	0x17B5: true, // khmer vowel inherent aa
	0x2800: true, // braille em branco
	0x3164: true, // hangul filler
	0xFFA0: true, // halfwidth hangul filler
}

// emojiPart: o que pode vir colado a um ZWJ numa sequência de emoji
// (símbolo, tom de pele ou o VS16 de um símbolo).
func emojiPart(r rune) bool {
	return unicode.In(r, unicode.So, unicode.Sk) || r == variationSelector16
}

// CheckNameChars confere os caracteres de um nome já sem espaços nas pontas.
// O ZWJ só vale entre emoji (👨‍👩‍👧) e o VS16 só depois de símbolo, dígito ou
// pontuação (❤️, 1️⃣).
func CheckNameChars(name string) error {
	runes := []rune(name)
	visible := false
	for i, r := range runes {
		switch {
		case r == zeroWidthJoiner:
			if i == 0 || i+1 >= len(runes) || !emojiPart(runes[i-1]) || !unicode.Is(unicode.So, runes[i+1]) {
				return ErrNameInvalidChars
			}
			continue
		case r == variationSelector16:
			if i == 0 || !unicode.In(runes[i-1], unicode.So, unicode.Sm, unicode.Sk, unicode.Nd, unicode.P) {
				return ErrNameInvalidChars
			}
			continue
		case r == replacementChar || invisibleRunes[r]:
			return ErrNameInvalidChars
		case unicode.In(r, unicode.Cc, unicode.Cf, unicode.Zl, unicode.Zp):
			return ErrNameInvalidChars
		}
		if unicode.In(r, unicode.L, unicode.N, unicode.P, unicode.S) {
			visible = true
		}
	}
	if !visible {
		return ErrNameBlank
	}
	return nil
}

// NormalizeName tira os espaços das pontas e confere o nome: de 1 a max
// caracteres, todos permitidos. Devolve o nome arrumado.
func NormalizeName(raw string, max int) (string, error) {
	name := strings.TrimSpace(raw)
	if name == "" {
		return "", ErrNameEmpty
	}
	if utf8.RuneCountInString(name) > max {
		return "", ErrNameTooLong
	}
	if err := CheckNameChars(name); err != nil {
		return "", err
	}
	return name, nil
}
