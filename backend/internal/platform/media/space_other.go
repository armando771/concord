//go:build !unix

package media

import "math"

// Fora de unix (dev no Windows) não medimos: sempre "cabe".
func freeBytes(string) (uint64, error) {
	return math.MaxUint64, nil
}
