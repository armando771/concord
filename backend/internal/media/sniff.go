// Package media guarda os anexos do chat no disco e decide o tipo deles
// pelos bytes do arquivo (nunca pelo que o cliente declarou).
package media

import (
	"bytes"
	"strings"
)

type Kind string

const (
	KindImage Kind = "image"
	KindVideo Kind = "video"
	KindAudio Kind = "audio"
)

// MaxFileBytes é o limite por arquivo (25 MB); o app usa o mesmo número.
const MaxFileBytes int64 = 25 << 20

// SniffLen é quantos bytes do começo do arquivo o Sniff precisa.
const SniffLen = 512

// mp4Brands são as marcas ISO-BMFF de mp4/m4a. Outras (heic, avif, qt, 3gp...)
// usam o mesmo contêiner mas não tocam como mp4: são recusadas.
var mp4Brands = map[string]bool{
	"isom": true, "iso2": true, "iso4": true, "iso5": true, "iso6": true,
	"mp41": true, "mp42": true, "avc1": true, "dash": true, "M4V ": true,
	"M4A ": true, "M4B ": true,
}

// Sniff descobre o tipo pelos primeiros bytes. declared (o Content-Type da
// parte do multipart) só desempata mp4/webm entre vídeo e áudio.
func Sniff(head []byte, declared string) (kind Kind, contentType string, ok bool) {
	declaredAudio := strings.HasPrefix(strings.ToLower(strings.TrimSpace(declared)), "audio/")

	switch {
	case bytes.HasPrefix(head, []byte("\x89PNG\r\n\x1a\n")):
		return KindImage, "image/png", true
	case bytes.HasPrefix(head, []byte("\xff\xd8\xff")):
		return KindImage, "image/jpeg", true
	case bytes.HasPrefix(head, []byte("GIF87a")), bytes.HasPrefix(head, []byte("GIF89a")):
		return KindImage, "image/gif", true
	case len(head) >= 12 && bytes.HasPrefix(head, []byte("RIFF")) && string(head[8:12]) == "WEBP":
		return KindImage, "image/webp", true
	case len(head) >= 12 && bytes.HasPrefix(head, []byte("RIFF")) && string(head[8:12]) == "WAVE":
		return KindAudio, "audio/wav", true
	case len(head) >= 12 && string(head[4:8]) == "ftyp":
		brand := string(head[8:12])
		if !mp4Brands[brand] {
			return "", "", false
		}
		if brand == "M4A " || brand == "M4B " || declaredAudio {
			return KindAudio, "audio/mp4", true
		}
		return KindVideo, "video/mp4", true
	case bytes.HasPrefix(head, []byte("\x1a\x45\xdf\xa3")):
		// Matroska genérico (mkv) não é aceito; só o perfil webm.
		if !bytes.Contains(head[:min(len(head), 64)], []byte("webm")) {
			return "", "", false
		}
		if declaredAudio {
			return KindAudio, "audio/webm", true
		}
		return KindVideo, "video/webm", true
	case bytes.HasPrefix(head, []byte("OggS")):
		return KindAudio, "audio/ogg", true
	case bytes.HasPrefix(head, []byte("ID3")):
		return KindAudio, "audio/mpeg", true
	case len(head) >= 2 && head[0] == 0xFF && head[1]&0xE0 == 0xE0:
		// Sincronismo de quadro MPEG (mp3 sem tag ID3).
		return KindAudio, "audio/mpeg", true
	}
	return "", "", false
}
