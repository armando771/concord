package guest

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"
)

// tokenLength: 32 bytes aleatórios em base64url sem padding (256 bits).
const tokenLength = 43

// newToken gera o token do link. Ele só aparece uma vez (na resposta de quem
// gerou); o banco guarda o hash.
func newToken() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b) // crypto/rand não falha (Go 1.24+)
	return base64.RawURLEncoding.EncodeToString(b)
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// validToken: formato do token (antes de ir ao banco).
func validToken(token string) bool {
	if len(token) != tokenLength {
		return false
	}
	for _, r := range token {
		if !isTokenRune(r) {
			return false
		}
	}
	return true
}

func isTokenRune(r rune) bool {
	return r == '-' || r == '_' || r < unicode.MaxASCII && (unicode.IsLetter(r) || unicode.IsDigit(r))
}

// normalizeDisplayName: o nome que o visitante digita. Espaços em volta e
// repetidos somem; de 2 a 32 caracteres; nada de controle nem de caracteres
// invisíveis/de direção (que servem para se passar por outra pessoa).
func normalizeDisplayName(raw string) (string, error) {
	name := strings.Join(strings.Fields(raw), " ")
	n := utf8.RuneCountInString(name)
	if n < 2 || n > 32 || strings.IndexFunc(name, forbiddenNameRune) >= 0 {
		return "", ErrInvalidName
	}
	return name, nil
}

func forbiddenNameRune(r rune) bool {
	return unicode.IsControl(r) || unicode.Is(unicode.Cf, r)
}

// newGuestUser monta o usuário efêmero. O @ tem hífen, que o cadastro não
// aceita: nunca colide com uma conta de verdade.
func newGuestUser(displayName string) GuestUser {
	id := uuid.NewString()
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return GuestUser{
		ID:          id,
		Username:    "visitante-" + hex.EncodeToString(b),
		DisplayName: displayName,
		Email:       id + "@visitante.invalid",
	}
}
