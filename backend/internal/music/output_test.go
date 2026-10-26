package music

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"math/rand"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/livekit/server-sdk-go/v2/pkg/oggreader"
)

func TestEncoderArgsHiFi(t *testing.T) {
	args := strings.Join(EncoderArgs(), " ")
	for _, want := range []string{
		"-f f32le -ar 48000 -ac 2 -i pipe:0",
		"-c:a libopus", "-b:a 320k", "-vbr off", "-application audio",
		"-frame_duration 20", "-page_duration 20000", "-flush_packets 1", "-f ogg pipe:1",
	} {
		if !strings.Contains(args, want) {
			t.Errorf("faltou %q em %q", want, args)
		}
	}
}

// O SDK do LiveKit (pion) recusa amostras acima de 1200 bytes e, na primeira
// recusa, para de escrever a faixa para sempre: o Maestro fica mudo. Nenhum
// frame do encoder pode passar disso, nem nos ataques de uma música.
func TestEncoderFramesFitRTPPacket(t *testing.T) {
	ff, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg ausente")
	}
	src := &transientSource{r: rand.New(rand.NewSource(1))}
	frame := make([]float32, FrameLen)
	var pcm bytes.Buffer
	for i := 0; i < 150; i++ { // 3 s
		src.ReadFrame(frame)
		for _, v := range frame {
			_ = binary.Write(&pcm, binary.LittleEndian, v)
		}
	}
	cmd := exec.Command(ff, EncoderArgs()...)
	cmd.Stdin = &pcm
	var out, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &stderr
	if err := cmd.Run(); err != nil {
		t.Fatalf("ffmpeg: %v: %s", err, stderr.String())
	}

	reader, _, err := oggreader.NewOggReader(&out)
	if err != nil {
		t.Fatal(err)
	}
	var packets, biggest int
	for {
		pkt, err := reader.ReadPacket()
		if err != nil {
			break
		}
		packets++
		if len(pkt) > biggest {
			biggest = len(pkt)
		}
	}
	if packets < 100 {
		t.Fatalf("poucos pacotes Opus: %d", packets)
	}
	if biggest > maxOpusPacket {
		t.Fatalf("frame Opus de %d bytes (máximo %d): o SDK pararia a faixa", biggest, maxOpusPacket)
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

func TestRunAttemptsRetriesOnceThenGivesUp(t *testing.T) {
	calls := 0
	err := runAttempts(context.Background(), 2, func(context.Context) error {
		calls++
		return errors.New("caiu")
	})
	if calls != 2 || err == nil {
		t.Fatalf("calls=%d err=%v", calls, err)
	}
}

func TestRunAttemptsStopsWhenCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	calls := 0
	_ = runAttempts(ctx, 2, func(context.Context) error {
		calls++
		cancel()
		return errors.New("cancelado")
	})
	if calls != 1 {
		t.Fatalf("calls=%d, quer 1", calls)
	}
}
