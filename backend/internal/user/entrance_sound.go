package user

import (
	"errors"
	"strconv"
	"strings"

	"github.com/google/uuid"
)

// Som de entrada: um clipe curto que toca para quem já está na call quando a
// pessoa entra (como o "entrance sound" do Discord). Fica na pasta do perfil,
// fora da limpeza dos anexos.
const EntranceSoundDir = "entrance-sounds"

const (
	// MaxEntranceSoundBytes: 2 MB cabem 5 s até de WAV sem compressão.
	MaxEntranceSoundBytes int64 = 2 << 20

	// Mesmo piso da mesa de áudio (0,1 s), teto bem menor: é um aviso de
	// entrada, não um áudio para ouvir.
	MinEntranceSoundMs = 100
	MaxEntranceSoundMs = 5_000
)

var ErrInvalidEntranceDuration = errors.New("o som de entrada precisa ter entre 0,1 s e 5 s")

const entranceSoundPath = "/api/entrance-sounds/"

// parseEntranceDuration confere a duração que o app mediu (como na mesa de
// áudio, o servidor não decodifica o áudio).
func parseEntranceDuration(raw string) (int, error) {
	ms, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || ms < MinEntranceSoundMs || ms > MaxEntranceSoundMs {
		return 0, ErrInvalidEntranceDuration
	}
	return ms, nil
}

// entranceSoundURL é a URL guardada em entrance_sound_url.
func entranceSoundURL(id string) string { return entranceSoundPath + id }

// parseSoundID aceita só UUID canônico (o nome do arquivo no disco).
func parseSoundID(raw string) (string, bool) {
	parsed, err := uuid.Parse(raw)
	if err != nil || parsed.String() != raw {
		return "", false
	}
	return raw, true
}

// entranceSoundIDFromURL acha o arquivo de uma URL salva (para apagar na troca).
func entranceSoundIDFromURL(url *string) (string, bool) {
	if url == nil {
		return "", false
	}
	raw, found := strings.CutPrefix(*url, entranceSoundPath)
	if !found {
		return "", false
	}
	return parseSoundID(raw)
}
