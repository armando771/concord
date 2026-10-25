package music

import (
	"context"
	"errors"
	"strings"
	"testing"
)

type fakeRun struct {
	args   []string
	stdout string
	stderr string
	err    error
}

func (f *fakeRun) run(_ context.Context, name string, args ...string) ([]byte, []byte, error) {
	f.args = append([]string{name}, args...)
	return []byte(f.stdout), []byte(f.stderr), f.err
}

func TestResolveParsesTrack(t *testing.T) {
	f := &fakeRun{stdout: `{"id":"dQw4w9WgXcQ","title":"Never Gonna Give You Up (Official Video)","track":"Never Gonna Give You Up","artist":"Rick Astley","channel":"Rick Astley","thumbnail":"https://i.ytimg.com/x.jpg","duration":213,"is_live":false,"live_status":"not_live","age_limit":0,"formats":[{"vcodec":"none"},{"vcodec":"avc1.640028","height":1080}]}`}
	y := NewYTDLP("yt-dlp", "", "", f.run)
	tr, err := y.Resolve(context.Background(), "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
	if err != nil {
		t.Fatal(err)
	}
	if tr.VideoID != "dQw4w9WgXcQ" || tr.Title != "Never Gonna Give You Up" || tr.Artist != "Rick Astley" ||
		tr.DurationMs != 213_000 || !tr.HasVideo || tr.IsLive || tr.Thumbnail != "https://i.ytimg.com/x.jpg" {
		t.Fatalf("track = %+v", tr)
	}
	joined := strings.Join(f.args, " ")
	for _, want := range []string{"-J", "--skip-download", "--no-playlist", "--no-warnings"} {
		if !strings.Contains(joined, want) {
			t.Errorf("faltou %q em %q", want, joined)
		}
	}
}

func TestResolveArtTrackHasNoVideo(t *testing.T) {
	f := &fakeRun{stdout: `{"id":"abcdefghijk","title":"Song","channel":"Banda - Topic","duration":200,"formats":[{"vcodec":"avc1","height":1080}]}`}
	tr, err := NewYTDLP("yt-dlp", "", "", f.run).Resolve(context.Background(), "u")
	if err != nil {
		t.Fatal(err)
	}
	if tr.HasVideo || tr.Artist != "Banda" {
		t.Fatalf("track = %+v", tr)
	}
}

func TestResolveLiveAndAge(t *testing.T) {
	live := &fakeRun{stdout: `{"id":"abcdefghijk","title":"x","duration":0,"live_status":"is_live"}`}
	tr, err := NewYTDLP("yt-dlp", "", "", live.run).Resolve(context.Background(), "u")
	if err != nil || !tr.IsLive {
		t.Fatalf("live: %+v %v", tr, err)
	}
	age := &fakeRun{stdout: `{"id":"abcdefghijk","title":"x","duration":10,"age_limit":18}`}
	if _, err := NewYTDLP("yt-dlp", "", "", age.run).Resolve(context.Background(), "u"); !errors.Is(err, ErrPrivate) {
		t.Fatalf("age: %v", err)
	}
}

func TestResolveMapsErrors(t *testing.T) {
	cases := map[string]error{
		"ERROR: [youtube] x: Private video. Sign in if you've been granted access": ErrPrivate,
		"ERROR: [youtube] x: Sign in to confirm your age":                          ErrPrivate,
		"ERROR: [youtube] x: Video unavailable":                                    ErrUnavailable,
	}
	for stderr, want := range cases {
		f := &fakeRun{stderr: stderr, err: errors.New("exit status 1")}
		if _, err := NewYTDLP("yt-dlp", "", "", f.run).Resolve(context.Background(), "u"); !errors.Is(err, want) {
			t.Errorf("%q: err = %v, want %v", stderr, err, want)
		}
	}
}

func TestCookiesAndPOTArgs(t *testing.T) {
	f := &fakeRun{stdout: `{"id":"abcdefghijk","title":"x","duration":10}`}
	y := NewYTDLP("yt-dlp", "/c/cookies.txt", "http://127.0.0.1:4416", f.run)
	if _, err := y.Resolve(context.Background(), "u"); err != nil {
		t.Fatal(err)
	}
	joined := strings.Join(f.args, " ")
	if !strings.Contains(joined, "--cookies /c/cookies.txt") ||
		!strings.Contains(joined, "--extractor-args youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416") {
		t.Fatalf("args = %q", joined)
	}
}

func TestSearchAndPlaylist(t *testing.T) {
	f := &fakeRun{stdout: `{"title":"Rock Anos 80","entries":[
		{"id":"aaaaaaaaaaa","title":"Um","channel":"A","duration":100},
		{"id":"bbbbbbbbbbb","title":"[Private video]","duration":null},
		{"id":"ccccccccccc","title":"Três","channel":"C","duration":200}]}`}
	y := NewYTDLP("yt-dlp", "", "", f.run)
	name, tracks, err := y.Playlist(context.Background(), "https://www.youtube.com/playlist?list=PL1", 50)
	if err != nil || name != "Rock Anos 80" || len(tracks) != 2 || tracks[1].VideoID != "ccccccccccc" {
		t.Fatalf("name=%q tracks=%+v err=%v", name, tracks, err)
	}
	if !strings.Contains(strings.Join(f.args, " "), "--playlist-end 50") {
		t.Fatalf("args = %v", f.args)
	}
	if tracks[0].Thumbnail != "https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg" {
		t.Fatalf("thumb = %q", tracks[0].Thumbnail)
	}

	results, err := y.Search(context.Background(), "lofi", 5)
	if err != nil || len(results) != 2 {
		t.Fatalf("search: %+v %v", results, err)
	}
	if !strings.Contains(strings.Join(f.args, " "), "ytsearch5:lofi") {
		t.Fatalf("args = %v", f.args)
	}
}

func TestDownloadAudioArgs(t *testing.T) {
	f := &fakeRun{stdout: "/cache/dQw4w9WgXcQ.audio.webm\n"}
	path, err := NewYTDLP("yt-dlp", "", "", f.run).DownloadAudio(context.Background(), "dQw4w9WgXcQ", "/cache")
	if err != nil || path != "/cache/dQw4w9WgXcQ.audio.webm" {
		t.Fatalf("path=%q err=%v", path, err)
	}
	joined := strings.Join(f.args, " ")
	if !strings.Contains(joined, "-f 774/251/bestaudio") || !strings.Contains(joined, "--print after_move:filepath") {
		t.Fatalf("args = %q", joined)
	}
}

func TestDownloadVideoArgs(t *testing.T) {
	f := &fakeRun{stdout: "/cache/x.video.mp4\n"}
	if _, err := NewYTDLP("yt-dlp", "", "", f.run).DownloadVideo(context.Background(), "dQw4w9WgXcQ", "/cache"); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(strings.Join(f.args, " "), "-f bestvideo[height<=1080][vcodec^=avc1]/bestvideo[height<=1080]") {
		t.Fatalf("args = %v", f.args)
	}
}
