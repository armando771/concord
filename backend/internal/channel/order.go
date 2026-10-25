package channel

import "errors"

var (
	ErrInvalidType  = errors.New("type must be text or voice")
	ErrInvalidOrder = errors.New("channel_ids must list each channel of this type in the server exactly once")
)

// ValidateOrder confere que a nova ordem é uma permutação dos canais atuais
// daquele servidor e tipo: nenhum faltando, sobrando, repetido ou de fora.
func ValidateOrder(current, requested []string) error {
	if len(current) != len(requested) {
		return ErrInvalidOrder
	}
	remaining := make(map[string]bool, len(current))
	for _, id := range current {
		remaining[id] = true
	}
	for _, id := range requested {
		if !remaining[id] {
			return ErrInvalidOrder
		}
		delete(remaining, id)
	}
	return nil
}
