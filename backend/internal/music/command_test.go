package music

import "testing"

func TestParseCommand(t *testing.T) {
	cases := []struct {
		in   string
		kind Kind
		arg  string
		ok   bool
	}{
		{"/play https://youtu.be/dQw4w9WgXcQ", KindPlay, "https://youtu.be/dQw4w9WgXcQ", true},
		{"  /P   lofi hip hop ", KindPlay, "lofi hip hop", true},
		{"/tocar\nqueen", KindPlay, "queen", true},
		{"/skip", KindSkip, "", true},
		{"/s", KindSkip, "", true},
		{"/pular", KindSkip, "", true},
		{"/fila", KindQueue, "", true},
		{"/q", KindQueue, "", true},
		{"/help", KindHelp, "", true},
		{"/ajuda", KindHelp, "", true},
		{"/musica", KindHelp, "", true},
		{"/música", KindHelp, "", true},
		{"/play", KindPlay, "", true},
		{"/shrug", 0, "", false},
		{"play queen", 0, "", false},
		{"olá /play x", 0, "", false},
	}
	for _, c := range cases {
		got, ok := ParseCommand(c.in)
		if ok != c.ok || got.Kind != c.kind || got.Arg != c.arg {
			t.Errorf("ParseCommand(%q) = %+v,%v; want kind=%v arg=%q ok=%v", c.in, got, ok, c.kind, c.arg, c.ok)
		}
	}
}

func TestClassifyArg(t *testing.T) {
	cases := []struct {
		in      string
		kind    ArgKind
		videoID string
		listID  string
		url     string
	}{
		{"https://www.youtube.com/watch?v=dQw4w9WgXcQ", ArgVideo, "dQw4w9WgXcQ", "", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
		{"youtube.com/watch?v=dQw4w9WgXcQ&t=30", ArgVideo, "dQw4w9WgXcQ", "", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
		{"https://youtu.be/dQw4w9WgXcQ?si=abc", ArgVideo, "dQw4w9WgXcQ", "", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
		{"https://music.youtube.com/watch?v=dQw4w9WgXcQ", ArgVideo, "dQw4w9WgXcQ", "", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
		{"https://m.youtube.com/shorts/dQw4w9WgXcQ", ArgVideo, "dQw4w9WgXcQ", "", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
		{"https://www.youtube.com/playlist?list=PL123abc", ArgPlaylist, "", "PL123abc", "https://www.youtube.com/playlist?list=PL123abc"},
		{"https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123abc", ArgPlaylist, "dQw4w9WgXcQ", "PL123abc", "https://www.youtube.com/playlist?list=PL123abc"},
		// Mix automático (RD...) é infinito: vale só o vídeo.
		{"https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ", ArgVideo, "dQw4w9WgXcQ", "", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
		{"https://open.spotify.com/track/xyz", ArgOtherURL, "", "", ""},
		{"https://www.youtube.com/watch?v=curto", ArgOtherURL, "", "", ""},
		{"https://www.youtube.com/@canal", ArgOtherURL, "", "", ""},
		{"bohemian rhapsody", ArgSearch, "", "", ""},
	}
	for _, c := range cases {
		got := ClassifyArg(c.in)
		if got.Kind != c.kind || got.VideoID != c.videoID || got.ListID != c.listID || got.URL != c.url {
			t.Errorf("ClassifyArg(%q) = %+v", c.in, got)
		}
	}
	if q := ClassifyArg("  lofi  ").Query; q != "lofi" {
		t.Errorf("query = %q", q)
	}
}
