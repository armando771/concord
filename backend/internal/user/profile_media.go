package user

import (
	"strings"

	"github.com/google/uuid"
)

// Mídia do perfil (avatar e banner) fica numa pasta própria, fora da raiz dos
// anexos do chat: a limpeza dos anexos apaga o que não está em
// message_attachments e não pode encostar nela.
const ProfileMediaDir = "profile"

// MaxProfileImageBytes é o limite do avatar e do banner (10 MB, como no
// Discord); o app usa o mesmo número.
const MaxProfileImageBytes int64 = 10 << 20

const (
	profileMediaPath = "/api/profile-media/"
	animatedPrefix   = "a_"
)

// profileMediaURL é a URL guardada em avatar_url/banner_url. Como o hash do
// Discord, GIF animado ganha o prefixo "a_": o app sabe que anima sem baixar.
func profileMediaURL(id string, animated bool) string {
	if animated {
		return profileMediaPath + animatedPrefix + id
	}
	return profileMediaPath + id
}

// parseMediaID tira o "a_" e confere que sobrou um UUID canônico (o nome do
// arquivo no disco).
func parseMediaID(raw string) (id string, ok bool) {
	id = strings.TrimPrefix(raw, animatedPrefix)
	parsed, err := uuid.Parse(id)
	if err != nil || parsed.String() != id {
		return "", false
	}
	return id, true
}

// mediaIDFromURL acha o arquivo de uma URL salva (para apagar na troca).
func mediaIDFromURL(url *string) (string, bool) {
	if url == nil {
		return "", false
	}
	raw, found := strings.CutPrefix(*url, profileMediaPath)
	if !found {
		return "", false
	}
	return parseMediaID(raw)
}
