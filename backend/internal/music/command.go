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

var commandNames = indexCommandNames(commandSpecs)

func indexCommandNames(specs []CommandSpec) map[string]Kind {
	names := make(map[string]Kind)
	for _, spec := range specs {
		for _, name := range spec.Names {
			names[name] = spec.Kind
		}
	}
	return names
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

var youtubeHostPattern = regexp.MustCompile(`^(www\.|m\.|music\.)?(youtube\.com|youtu\.be)$`)

// hostPart devolve o trecho até o primeiro "/", "?" ou "#".
func hostPart(s string) string {
	if i := strings.IndexAny(s, "/?#"); i >= 0 {
		return s[:i]
	}
	return s
}

func videoURL(id string) string    { return "https://www.youtube.com/watch?v=" + id }
func playlistURL(id string) string { return "https://www.youtube.com/playlist?list=" + id }

// ClassifyArg diz se o argumento do /play é link de vídeo, de playlist, um
// link de outro site ou texto de busca.
func ClassifyArg(arg string) PlayArg {
	a := strings.TrimSpace(arg)
	lower := strings.ToLower(a)
	// Com espaço nunca é link; sem esquema, só vale se o host for do YouTube.
	hasScheme := strings.Contains(lower, "://")
	looksURL := !strings.ContainsFunc(a, unicode.IsSpace) &&
		(hasScheme || youtubeHostPattern.MatchString(hostPart(lower)))
	if !looksURL {
		return PlayArg{Kind: ArgSearch, Query: a}
	}
	if !hasScheme {
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
	case host == "youtube.com" && hasVideoPrefix(u.Path):
		videoID = strings.Trim(u.Path[strings.Index(u.Path[1:], "/")+2:], "/")
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

// hasVideoPrefix cobre /shorts/ID, /live/ID, /embed/ID e /v/ID.
func hasVideoPrefix(path string) bool {
	for _, p := range []string{"/shorts/", "/live/", "/embed/", "/v/"} {
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}
