package user

import (
	"context"
	"log"
	"time"
)

// MediaKeeper diz se uma URL de avatar/banner ainda é usada por alguém (o
// perfil ou um perfil salvo). Arquivo em uso não é apagado (ADR 0011).
type MediaKeeper interface {
	MediaInUse(ctx context.Context, url string) (bool, error)
}

// SetMediaKeeper liga quem guarda referências à mídia do perfil.
func (h *ProfileHandler) SetMediaKeeper(keeper MediaKeeper) {
	h.keeper = keeper
}

const keeperTimeout = 5 * time.Second

// inUse: na dúvida (erro no banco) o arquivo fica; sobra um arquivo, mas
// nenhum perfil salvo perde a imagem.
func (h *ProfileHandler) inUse(url string) bool {
	if h.keeper == nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), keeperTimeout)
	defer cancel()
	used, err := h.keeper.MediaInUse(ctx, url)
	if err != nil {
		log.Printf("[profile] conferir uso da mídia %s: %v", url, err)
		return true
	}
	return used
}
