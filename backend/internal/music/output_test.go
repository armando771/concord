package music

import (
	"bytes"
	"context"
	"os/exec"
	"strings"
	"testing"
	"time"
)

func TestEncoderArgsHiFi(t *testing.T) {
	args := strings.Join(EncoderArgs(), " ")
	for _, want := range []string{
		"-f f32le -ar 48000 -ac 2 -i pipe:0",
		"-c:a libopus", "-b:a 320k", "-vbr constrained", "-application audio",
		"-frame_duration 20", "-page_duration 20000", "-flush_packets 1", "-f ogg pipe:1",
	} {
		if !strings.Contains(args, want) {
			t.Errorf("faltou %q em %q", want, args)
		}
	}
}

// Prova que o ffmpeg real aceita as flags do encoder e devolve Ogg.
func TestEncoderArgsAcceptedByFFmpeg(t *testing.T) {
	ff, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg ausente")
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	cmd := exec.CommandContext(ctx, ff, EncoderArgs()...)
	stdin, _ := cmd.StdinPipe()
	var out, stderr bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &stderr
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	pctx, pcancel := context.WithCancel(context.Background())
	pw := &pipeWriter{stdin: stdin, n: 25, cancel: pcancel}
	_ = Pump(pctx, &countSource{}, pw, fastClock{}, time.Hour)
	_ = stdin.Close()
	if err := cmd.Wait(); err != nil {
		t.Fatalf("ffmpeg: %v: %s", err, stderr.String())
	}
	if !bytes.HasPrefix(out.Bytes(), []byte("OggS")) {
		t.Fatalf("saída não é Ogg (%d bytes): %s", out.Len(), stderr.String())
	}
}

type fastClock struct{}

func (fastClock) Now() time.Time      { return time.Unix(0, 0) }
func (fastClock) Sleep(time.Duration) {}

type pipeWriter struct {
	stdin  interface{ Write([]byte) (int, error) }
	n      int
	cancel context.CancelFunc
}

func (p *pipeWriter) Write(b []byte) (int, error) {
	n, err := p.stdin.Write(b)
	if p.n--; p.n == 0 {
		p.cancel()
	}
	return n, err
}
