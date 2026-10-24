package server

import (
	"crypto/rand"
	"math/big"
	"strings"
)

// Código de convite do servidor: 8 caracteres, sem os que se confundem ao
// digitar (0/O, 1/I/L).
const (
	inviteCodeLength   = 8
	inviteCodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
)

func newInviteCode() string {
	max := big.NewInt(int64(len(inviteCodeAlphabet)))
	code := make([]byte, inviteCodeLength)
	for i := range code {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			panic(err) // sem fonte de aleatoriedade não há o que fazer
		}
		code[i] = inviteCodeAlphabet[n.Int64()]
	}
	return string(code)
}

// normalizeInviteCode aceita o código como as pessoas digitam: minúsculas,
// espaços e hífens.
func normalizeInviteCode(input string) string {
	return strings.Map(func(r rune) rune {
		if r == ' ' || r == '-' {
			return -1
		}
		return r
	}, strings.ToUpper(strings.TrimSpace(input)))
}
