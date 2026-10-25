package music

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"
)

const (
	audioFormat = "774/251/bestaudio"
	videoFormat = "bestvideo[height<=1080][vcodec^=avc1]/bestvideo[height<=1080]"
)

type YTDLP struct {
	bin     string
	cookies string
	potURL  string
	run     Runner
}

func NewYTDLP(bin, cookies, potURL string, run Runner) *YTDLP {
	return &YTDLP{bin: bin, cookies: cookies, potURL: potURL, run: run}
}

type ytFormat struct {
	VCodec string `json:"vcodec"`
	Height int    `json:"height"`
}

type ytThumb struct {
	URL string `json:"url"`
}

type ytInfo struct {
	ID         string     `json:"id"`
	Title      string     `json:"title"`
	Track      string     `json:"track"`
	Artist     string     `json:"artist"`
	Channel    string     `json:"channel"`
	Uploader   string     `json:"uploader"`
	Thumbnail  string     `json:"thumbnail"`
	Thumbnails []ytThumb  `json:"thumbnails"`
	Duration   *float64   `json:"duration"`
	IsLive     bool       `json:"is_live"`
	LiveStatus string     `json:"live_status"`
	AgeLimit   int        `json:"age_limit"`
	Formats    []ytFormat `json:"formats"`
	Entries    []ytInfo   `json:"entries"`
}

func (y *YTDLP) base() []string {
	args := []string{"--no-warnings", "--no-progress"}
	if y.cookies != "" {
		args = append(args, "--cookies", y.cookies)
	}
	if y.potURL != "" {
		args = append(args, "--extractor-args", "youtubepot-bgutilhttp:base_url="+y.potURL)
	}
	return args
}

func (y *YTDLP) json(ctx context.Context, args ...string) (*ytInfo, error) {
	stdout, stderr, err := y.run(ctx, y.bin, append(y.base(), args...)...)
	if err != nil {
		return nil, mapYTError(string(stderr), err)
	}
	var info ytInfo
	if err := json.Unmarshal(stdout, &info); err != nil {
		return nil, fmt.Errorf("%w: json do yt-dlp: %v", ErrUnavailable, err)
	}
	return &info, nil
}

func mapYTError(stderr string, err error) error {
	s := strings.ToLower(stderr)
	for _, p := range []string{"private video", "confirm your age", "age-restricted", "members-only", "inappropriate for some users"} {
		if strings.Contains(s, p) {
			return fmt.Errorf("%w: %s", ErrPrivate, strings.TrimSpace(stderr))
		}
	}
	return fmt.Errorf("%w: %v: %s", ErrUnavailable, err, strings.TrimSpace(stderr))
}

// toTrack: "Art Track" (canal "X - Topic") é capa fixa, sem vídeo de verdade.
func toTrack(i ytInfo) Track {
	title := i.Title
	if i.Track != "" {
		title = i.Track
	}
	channel := i.Channel
	if channel == "" {
		channel = i.Uploader
	}
	artist := i.Artist
	if artist == "" {
		artist = strings.TrimSuffix(channel, " - Topic")
	}
	isTopic := strings.HasSuffix(channel, " - Topic")
	hasVideo := !isTopic
	if len(i.Formats) > 0 {
		hasVideo = false
		for _, f := range i.Formats {
			if f.VCodec != "" && f.VCodec != "none" && f.Height > 0 {
				hasVideo = !isTopic
				break
			}
		}
	}
	thumb := i.Thumbnail
	if thumb == "" && len(i.Thumbnails) > 0 {
		thumb = i.Thumbnails[len(i.Thumbnails)-1].URL
	}
	if thumb == "" {
		thumb = "https://i.ytimg.com/vi/" + i.ID + "/hqdefault.jpg"
	}
	var dur int64
	if i.Duration != nil {
		dur = int64(*i.Duration * 1000)
	}
	return Track{
		VideoID:    i.ID,
		Title:      title,
		Artist:     artist,
		Channel:    channel,
		Thumbnail:  thumb,
		DurationMs: dur,
		IsLive:     i.IsLive || i.LiveStatus == "is_live" || i.LiveStatus == "is_upcoming",
		HasVideo:   hasVideo,
	}
}

func (y *YTDLP) Resolve(ctx context.Context, url string) (Track, error) {
	info, err := y.json(ctx, "-J", "--skip-download", "--no-playlist", url)
	if err != nil {
		return Track{}, err
	}
	if info.AgeLimit >= 18 {
		return Track{}, ErrPrivate
	}
	return toTrack(*info), nil
}

// entries filtra vídeos privados/apagados da lista (vêm sem duração).
func entries(info *ytInfo) []Track {
	var out []Track
	for _, e := range info.Entries {
		if e.ID == "" || e.Duration == nil || strings.HasPrefix(e.Title, "[") {
			continue
		}
		t := toTrack(e)
		if t.IsLive {
			continue
		}
		out = append(out, t)
	}
	return out
}

func (y *YTDLP) Search(ctx context.Context, query string, n int) ([]Track, error) {
	info, err := y.json(ctx, "-J", "--flat-playlist", "ytsearch"+strconv.Itoa(n)+":"+query)
	if err != nil {
		return nil, err
	}
	return entries(info), nil
}

func (y *YTDLP) Playlist(ctx context.Context, url string, max int) (string, []Track, error) {
	info, err := y.json(ctx, "-J", "--flat-playlist", "--playlist-end", strconv.Itoa(max), url)
	if err != nil {
		return "", nil, err
	}
	return info.Title, entries(info), nil
}

func (y *YTDLP) download(ctx context.Context, format, suffix, videoID, dir string) (string, error) {
	args := append(y.base(), "-f", format, "--no-playlist",
		"-o", filepath.Join(dir, videoID+suffix+".%(ext)s"),
		"--print", "after_move:filepath", videoURL(videoID))
	stdout, stderr, err := y.run(ctx, y.bin, args...)
	if err != nil {
		return "", mapYTError(string(stderr), err)
	}
	lines := strings.Split(strings.TrimSpace(string(stdout)), "\n")
	return strings.TrimSpace(lines[len(lines)-1]), nil
}

func (y *YTDLP) DownloadAudio(ctx context.Context, videoID, dir string) (string, error) {
	return y.download(ctx, audioFormat, ".audio", videoID, dir)
}

func (y *YTDLP) DownloadVideo(ctx context.Context, videoID, dir string) (string, error) {
	return y.download(ctx, videoFormat, ".video", videoID, dir)
}
