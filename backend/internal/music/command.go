package music

import (
	"net/url"
	"regexp"
	"strings"
	"unicode"
)

type Kind int

const (
	KindPlay Kind = iota + 1
	KindSkip
	KindQueue
	KindHelp
)

type Command struct {
	Kind Kind
	Arg  string
}

var commandNames = map[string]Kind{
	"/play": KindPlay, "/p": KindPlay, "/tocar": KindPlay,
	"/skip": KindSkip, "/s": KindSkip, "/pular": KindSkip,
	"/fila": KindQueue, "/q": KindQueue,
	"/help": KindHelp, "/ajuda": KindHelp, "/musica": KindHelp, "/música": KindHelp,
}

// ParseCommand reconhece um comando do Maestro no começo da mensagem.
// Texto que não começa com um comando conhecido segue como mensagem comum.
func ParseCommand(text string) (Command, bool) {
	t := strings.TrimSpace(text)
	if !strings.HasPrefix(t, "/") {
		return Command{}, false
	}
	name, arg := t, ""
	if i := strings.IndexFunc(t, unicode.IsSpace); i >= 0 {
		name, arg = t[:i], strings.TrimSpace(t[i:])
	}
	kind, ok := commandNames[strings.ToLower(name)]
	if !ok {
		return Command{}, false
	}
	return Command{Kind: kind, Arg: arg}, true
}

type ArgKind int

const (
	ArgSearch ArgKind = iota + 1
	ArgVideo
	ArgPlaylist
	ArgOtherURL
)

type PlayArg struct {
	Kind    ArgKind
	VideoID string
	ListID  string
	Query   string
	// URL canônica que vai para o yt-dlp (vídeo ou playlist).
	URL string
}

var videoIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)

func videoURL(id string) string    { return "https://www.youtube.com/watch?v=" + id }
func playlistURL(id string) string { return "https://www.youtube.com/playlist?list=" + id }

// ClassifyArg diz se o argumento do /play é link de vídeo, de playlist, um
// link de outro site ou texto de busca.
func ClassifyArg(arg string) PlayArg {
	a := strings.TrimSpace(arg)
	lower := strings.ToLower(a)
	looksURL := strings.Contains(lower, "://") || strings.HasPrefix(lower, "www.") ||
		strings.HasPrefix(lower, "youtu") || strings.HasPrefix(lower, "music.youtube") ||
		strings.HasPrefix(lower, "m.youtube")
	if !looksURL {
		return PlayArg{Kind: ArgSearch, Query: a}
	}
	if !strings.Contains(lower, "://") {
		a = "https://" + a
	}
	u, err := url.Parse(a)
	if err != nil {
		return PlayArg{Kind: ArgOtherURL}
	}
	host := strings.ToLower(u.Hostname())
	for _, p := range []string{"www.", "m.", "music."} {
		host = strings.TrimPrefix(host, p)
	}

	var videoID string
	switch {
	case host == "youtu.be":
		videoID = strings.Trim(u.Path, "/")
	case host == "youtube.com" && u.Path == "/watch":
		videoID = u.Query().Get("v")
	case host == "youtube.com" && strings.HasPrefix(u.Path, "/shorts/"):
		videoID = strings.Trim(strings.TrimPrefix(u.Path, "/shorts/"), "/")
	case host == "youtube.com" && u.Path == "/playlist":
		if list := u.Query().Get("list"); list != "" {
			return PlayArg{Kind: ArgPlaylist, ListID: list, URL: playlistURL(list)}
		}
		return PlayArg{Kind: ArgOtherURL}
	default:
		return PlayArg{Kind: ArgOtherURL}
	}

	if !videoIDPattern.MatchString(videoID) {
		return PlayArg{Kind: ArgOtherURL}
	}
	// Mix automático ("RD...") não tem fim: toca só o vídeo.
	if list := u.Query().Get("list"); list != "" && !strings.HasPrefix(list, "RD") {
		return PlayArg{Kind: ArgPlaylist, VideoID: videoID, ListID: list, URL: playlistURL(list)}
	}
	return PlayArg{Kind: ArgVideo, VideoID: videoID, URL: videoURL(videoID)}
}
