package media

import "testing"

// pad completa o prefixo com zeros até n bytes.
func pad(b []byte, n int) []byte {
	if len(b) >= n {
		return b
	}
	return append(b, make([]byte, n-len(b))...)
}

func TestSniff(t *testing.T) {
	cases := []struct {
		name, declared string
		head           []byte
		kind           Kind
		ctype          string
		ok             bool
	}{
		{"png", "image/png", []byte("\x89PNG\r\n\x1a\n...."), KindImage, "image/png", true},
		{"jpeg", "", []byte("\xff\xd8\xff\xe0...."), KindImage, "image/jpeg", true},
		{"gif", "image/gif", []byte("GIF89a...."), KindImage, "image/gif", true},
		{"webp", "", []byte("RIFF\x00\x00\x00\x00WEBPVP8 "), KindImage, "image/webp", true},
		{"wav", "audio/wav", []byte("RIFF\x00\x00\x00\x00WAVEfmt "), KindAudio, "audio/wav", true},
		{"mp4 vídeo", "video/mp4", []byte("\x00\x00\x00\x18ftypisom\x00\x00\x02\x00"), KindVideo, "video/mp4", true},
		{"m4a pela marca", "", []byte("\x00\x00\x00\x18ftypM4A \x00\x00\x02\x00"), KindAudio, "audio/mp4", true},
		{"mp4 declarado áudio", "audio/x-m4a", []byte("\x00\x00\x00\x18ftypisom\x00\x00\x02\x00"), KindAudio, "audio/mp4", true},
		{"webm vídeo", "video/webm", append([]byte("\x1a\x45\xdf\xa3\x9f\x42\x86\x81\x01\x42\x82\x84"), []byte("webm")...), KindVideo, "video/webm", true},
		{"webm gravação", "audio/webm;codecs=opus", append([]byte("\x1a\x45\xdf\xa3\x9f\x42\x86\x81\x01\x42\x82\x84"), []byte("webm")...), KindAudio, "audio/webm", true},
		{"mkv não", "video/x-matroska", append([]byte("\x1a\x45\xdf\xa3\x9f\x42\x86\x81\x01\x42\x82\x88"), []byte("matroska")...), "", "", false},
		{"ogg", "audio/ogg", []byte("OggS\x00\x02...."), KindAudio, "audio/ogg", true},
		{"mp3 id3", "audio/mpeg", []byte("ID3\x04\x00...."), KindAudio, "audio/mpeg", true},
		{"mp3 sem id3", "", []byte("\xff\xfb\x90\x64...."), KindAudio, "audio/mpeg", true},
		{"svg disfarçado", "image/png", []byte("<svg xmlns=\"http://www.w3.org/2000/svg\">"), "", "", false},
		{"html disfarçado", "image/png", []byte("<!doctype html><script>"), "", "", false},
		{"pdf", "application/pdf", []byte("%PDF-1.7"), "", "", false},
		{"vazio", "image/png", nil, "", "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			head := tc.head
			if head != nil {
				head = pad(head, 32)
			}
			kind, ctype, ok := Sniff(head, tc.declared)
			if kind != tc.kind || ctype != tc.ctype || ok != tc.ok {
				t.Fatalf("Sniff = (%q, %q, %v), want (%q, %q, %v)", kind, ctype, ok, tc.kind, tc.ctype, tc.ok)
			}
		})
	}
}

func TestMaxFileBytesIs25MiB(t *testing.T) {
	if MaxFileBytes != 26214400 {
		t.Fatalf("MaxFileBytes = %d, want 26214400", MaxFileBytes)
	}
}
