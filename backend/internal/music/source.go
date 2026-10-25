package music

import (
	"bytes"
	"context"
	"errors"
	"os/exec"
)

var (
	ErrPrivate     = errors.New("vídeo privado ou com restrição de idade")
	ErrUnavailable = errors.New("vídeo indisponível")
)

// Source é de onde vêm as músicas (yt-dlp de verdade, ou tons nos testes).
type Source interface {
	Resolve(ctx context.Context, url string) (Track, error)
	Search(ctx context.Context, query string, n int) ([]Track, error)
	Playlist(ctx context.Context, url string, max int) (string, []Track, error)
	DownloadAudio(ctx context.Context, videoID, dir string) (string, error)
	DownloadVideo(ctx context.Context, videoID, dir string) (string, error)
}

// Runner roda um processo e devolve stdout e stderr (trocável nos testes).
type Runner func(ctx context.Context, name string, args ...string) (stdout, stderr []byte, err error)

func ExecRunner(ctx context.Context, name string, args ...string) ([]byte, []byte, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	var out, errb bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &errb
	err := cmd.Run()
	return out.Bytes(), errb.Bytes(), err
}
