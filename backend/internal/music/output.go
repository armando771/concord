package music

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"os/exec"
	"sync"
	"time"

	"gin-quickstart/backend/internal/bot"

	"github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"
	"github.com/pion/webrtc/v4"
)

const pumpLead = 200 * time.Millisecond

// EncoderArgs: PCM do mixer → Opus 320 kbps estéreo em páginas Ogg de 20 ms.
func EncoderArgs() []string {
	return []string{
		"-hide_banner", "-loglevel", "error",
		"-f", "f32le", "-ar", "48000", "-ac", "2", "-i", "pipe:0",
		"-c:a", "libopus", "-b:a", "320k", "-vbr", "constrained", "-application", "audio",
		"-frame_duration", "20", "-page_duration", "20000", "-flush_packets", "1",
		"-f", "ogg", "pipe:1",
	}
}

// Output é a saída de áudio de um player. Done recebe um erro quando ela
// desistiu (encoder caiu duas vezes).
type Output interface {
	Done() <-chan error
	Close()
}

type BotTokens interface {
	IssueBot(room, identity, name string) (string, error)
}

type LiveKitConfig struct {
	URL    string // ws://127.0.0.1:<LIVEKIT_PORT>
	Tokens BotTokens
	FFmpeg string
}

type liveKitOutput struct {
	room   *lksdk.Room
	cancel context.CancelFunc
	done   chan error
	once   sync.Once
}

// NewLiveKitOutput entra na sala da chamada como "bot-music:<canal>" e
// publica o que o src tocar.
func NewLiveKitOutput(ctx context.Context, cfg LiveKitConfig, callID, channelID string, src FrameSource) (Output, error) {
	token, err := cfg.Tokens.IssueBot(callID, bot.Identity(channelID), bot.DisplayName)
	if err != nil {
		return nil, err
	}
	room, err := lksdk.ConnectToRoomWithToken(cfg.URL, token, lksdk.NewRoomCallback(), lksdk.WithAutoSubscribe(false))
	if err != nil {
		return nil, fmt.Errorf("conectar ao LiveKit: %w", err)
	}
	ctx, cancel := context.WithCancel(ctx)
	o := &liveKitOutput{room: room, cancel: cancel, done: make(chan error, 1)}
	go o.run(ctx, cfg.FFmpeg, src)
	return o, nil
}

func (o *liveKitOutput) Done() <-chan error { return o.done }

func (o *liveKitOutput) Close() {
	o.once.Do(func() {
		o.cancel()
		o.room.Disconnect()
	})
}

func (o *liveKitOutput) run(ctx context.Context, ffmpeg string, src FrameSource) {
	var err error
	for attempt := 1; attempt <= 2; attempt++ {
		err = o.runOnce(ctx, ffmpeg, src)
		if ctx.Err() != nil {
			return
		}
		log.Printf("[music] encoder caiu (tentativa %d): %v", attempt, err)
	}
	o.done <- err
}

func (o *liveKitOutput) runOnce(ctx context.Context, ffmpeg string, src FrameSource) error {
	cmd := exec.CommandContext(ctx, ffmpeg, EncoderArgs()...)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Start(); err != nil {
		return err
	}

	track, err := lksdk.NewLocalReaderTrack(stdout, webrtc.MimeTypeOpus)
	if err != nil {
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
		return err
	}
	pub, err := o.room.LocalParticipant.PublishTrack(track, &lksdk.TrackPublicationOptions{
		Name:       "music",
		Source:     livekit.TrackSource_MICROPHONE,
		Stereo:     true,
		DisableDTX: true,
	})
	if err != nil {
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
		return err
	}

	go func() {
		_ = Pump(ctx, src, stdin, RealClock{}, pumpLead)
		_ = stdin.Close()
	}()
	waitErr := cmd.Wait()
	_ = o.room.LocalParticipant.UnpublishTrack(pub.SID())
	return fmt.Errorf("ffmpeg: %v: %s", waitErr, stderr.String())
}
