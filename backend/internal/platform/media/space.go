package media

import (
	"log"
	"strconv"
	"strings"
)

// DefaultReserve é o espaço livre (5 GB) que os uploads nunca consomem: o
// mesmo disco tem o Postgres e os instaladores.
const DefaultReserve uint64 = 5 << 30

// ReserveFromEnv lê UPLOADS_MIN_FREE_GB (inteiro em GB).
func ReserveFromEnv(raw string) uint64 {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return DefaultReserve
	}
	gb, err := strconv.ParseUint(raw, 10, 32)
	if err != nil {
		log.Printf("UPLOADS_MIN_FREE_GB inválido (%q); usando 5 GB", raw)
		return DefaultReserve
	}
	return gb << 30
}

// Space diz se ainda cabe um upload sem invadir a reserva do disco.
type Space struct {
	dir     string
	reserve uint64
	free    func(string) (uint64, error)
}

func NewSpace(dir string, reserve uint64) *Space {
	return &Space{dir: dir, reserve: reserve, free: freeBytes}
}

func (s *Space) HasRoom(incoming int64) bool {
	free, err := s.free(s.dir)
	if err != nil {
		log.Printf("media: failed to measure free space in %s: %v", s.dir, err)
		return false
	}
	if incoming < 0 {
		incoming = 0
	}
	return hasRoom(free, uint64(incoming), s.reserve)
}

func hasRoom(free, incoming, reserve uint64) bool {
	return free >= reserve && free-reserve >= incoming
}
