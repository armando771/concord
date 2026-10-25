package music

import (
	"context"
	"fmt"
	"hash/fnv"
	"path/filepath"
	"strings"
)

// TestSource gera tons com ffmpeg no lugar do YouTube (e2e e dev sem rede).
// Cada vídeo dura 20 s e tem uma frequência própria (derivada do id).
type TestSource struct {
	ffmpeg string
	run    Runner
}

func NewTestSource(ffmpeg string, run Runner) *TestSource {
	return &TestSource{ffmpeg: ffmpeg, run: run}
}

const testDurationMs = 20_000

func testTrack(id string) Track {
	return Track{
		VideoID: id, Title: "Tom de teste " + id, Artist: "Concord", Channel: "Concord",
		Thumbnail: "", DurationMs: testDurationMs, HasVideo: true,
	}
}

func (s *TestSource) Resolve(_ context.Context, url string) (Track, error) {
	arg := ClassifyArg(url)
	if arg.VideoID == "" {
		return Track{}, ErrUnavailable
	}
	return testTrack(arg.VideoID), nil
}

func (s *TestSource) Search(_ context.Context, query string, n int) ([]Track, error) {
	out := make([]Track, n)
	for i := range out {
		out[i] = testTrack(fmt.Sprintf("busca%06d", i)) // 11 caracteres
	}
	return out, nil
}

func (s *TestSource) Playlist(_ context.Context, _ string, max int) (string, []Track, error) {
	n := 3
	if max < n {
		n = max
	}
	out := make([]Track, n)
	for i := range out {
		out[i] = testTrack(fmt.Sprintf("lista%06d", i))
	}
	return "Playlist de teste", out, nil
}

func freqFor(id string) int {
	h := fnv.New32a()
	h.Write([]byte(id))
	return 220 + int(h.Sum32()%660)
}

func (s *TestSource) DownloadAudio(ctx context.Context, videoID, dir string) (string, error) {
	out := filepath.Join(dir, videoID+".audio.opus")
	_, stderr, err := s.run(ctx, s.ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
		"-f", "lavfi", "-i", fmt.Sprintf("sine=frequency=%d:duration=20", freqFor(videoID)),
		"-ac", "2", "-c:a", "libopus", "-b:a", "160k", out)
	if err != nil {
		return "", fmt.Errorf("tom de teste: %v: %s", err, strings.TrimSpace(string(stderr)))
	}
	return out, nil
}

func (s *TestSource) DownloadVideo(ctx context.Context, videoID, dir string) (string, error) {
	out := filepath.Join(dir, videoID+".video.mp4")
	_, stderr, err := s.run(ctx, s.ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
		"-f", "lavfi", "-i", "testsrc=size=640x360:rate=30:duration=20",
		"-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out)
	if err != nil {
		return "", fmt.Errorf("vídeo de teste: %v: %s", err, strings.TrimSpace(string(stderr)))
	}
	return out, nil
}
