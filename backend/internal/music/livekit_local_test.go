package music

import (
	"context"
	"math"
	"math/rand"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"gin-quickstart/backend/internal/platform/livekit"

	lksdk "github.com/livekit/server-sdk-go/v2"
	"github.com/pion/webrtc/v4"
)

// transientSource toca um seno com rajadas de ruído que entram e saem: como
// os ataques de uma música, faz o Opus em VBR soltar frames acima de 1200
// bytes (o caso que derrubava a faixa do bot).
type transientSource struct {
	r      *rand.Rand
	n      int
	frames int
}

func (s *transientSource) ReadFrame(dst []float32) {
	burst := s.frames%10 < 2
	for i := 0; i < FrameSamples; i++ {
		v := 0.3 * math.Sin(2*math.Pi*440*float64(s.n)/SampleRate)
		l, r := v, v
		if burst {
			l, r = s.r.Float64()*1.6-0.8, s.r.Float64()*1.6-0.8
		}
		dst[i*Channels], dst[i*Channels+1] = float32(l), float32(r)
		s.n++
	}
	s.frames++
}

// Integração com um LiveKit de verdade: o ouvinte precisa receber a faixa do
// Maestro. Só roda com MUSIC_LIVEKIT_TEST_URL (ex.: livekit-server --dev).
func TestLiveKitLocalBotAudioReachesListener(t *testing.T) {
	url := os.Getenv("MUSIC_LIVEKIT_TEST_URL")
	if url == "" {
		t.Skip("MUSIC_LIVEKIT_TEST_URL não definido")
	}
	key, secret := os.Getenv("MUSIC_LIVEKIT_TEST_KEY"), os.Getenv("MUSIC_LIVEKIT_TEST_SECRET")
	ffmpeg := os.Getenv("MUSIC_FFMPEG")
	if ffmpeg == "" {
		ffmpeg = "ffmpeg"
	}
	tokens := livekit.NewTokenIssuer(key, secret)
	room := "room-test-" + time.Now().Format("150405")

	var packets, bytesIn atomic.Int64
	var mu sync.Mutex
	var codec, fmtp, from string
	cb := lksdk.NewRoomCallback()
	cb.OnTrackSubscribed = func(track *webrtc.TrackRemote, pub *lksdk.RemoteTrackPublication, rp *lksdk.RemoteParticipant) {
		mu.Lock()
		codec, fmtp, from = track.Codec().MimeType, track.Codec().SDPFmtpLine, rp.Identity()
		mu.Unlock()
		go func() {
			for {
				pkt, _, err := track.ReadRTP()
				if err != nil {
					return
				}
				packets.Add(1)
				bytesIn.Add(int64(len(pkt.Payload)))
			}
		}()
	}
	listenerToken, err := tokens.Issue(room, "listener", "Ouvinte", livekit.Grant{})
	if err != nil {
		t.Fatal(err)
	}
	listener, err := lksdk.ConnectToRoomWithToken(url, listenerToken, cb)
	if err != nil {
		t.Fatalf("ouvinte não conectou: %v", err)
	}
	defer listener.Disconnect()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	out, err := NewLiveKitOutput(ctx, LiveKitConfig{URL: url, Tokens: tokens, FFmpeg: ffmpeg}, room, "ch1", &transientSource{r: rand.New(rand.NewSource(1))})
	if err != nil {
		t.Fatalf("bot não conectou: %v", err)
	}
	defer out.Close()

	deadline := time.Now().Add(15 * time.Second)
	for time.Now().Before(deadline) && packets.Load() < 150 {
		select {
		case err := <-out.Done():
			t.Fatalf("saída do bot desistiu: %v", err)
		case <-time.After(200 * time.Millisecond):
		}
	}
	mu.Lock()
	defer mu.Unlock()
	t.Logf("de=%q codec=%q fmtp=%q pacotes=%d bytes=%d", from, codec, fmtp, packets.Load(), bytesIn.Load())
	if from != "bot-music:ch1" {
		t.Fatalf("ouvinte não assinou a faixa do bot (de=%q)", from)
	}
	if packets.Load() < 150 {
		t.Fatalf("poucos pacotes RTP do bot: %d", packets.Load())
	}
	// Áudio de verdade a 320 kbps são ~800 bytes por frame de 20 ms; ~80 é o
	// silêncio que sobra quando o SDK parou de escrever a faixa.
	if avg := bytesIn.Load() / packets.Load(); avg < 500 {
		t.Fatalf("pacotes de %d bytes em média: a faixa do bot está muda", avg)
	}
}
