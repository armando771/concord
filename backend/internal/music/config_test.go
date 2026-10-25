package music

import (
	"testing"
	"time"
)

func TestConfigFromEnv(t *testing.T) {
	t.Setenv("MUSIC_MAX_PLAYERS", "")
	t.Setenv("MUSIC_QUEUE_MAX", "")
	t.Setenv("MUSIC_IDLE_TIMEOUT", "")
	t.Setenv("MUSIC_TEST_SOURCE", "")
	c := ConfigFromEnv("7880")
	if c.MaxPlayers != 5 || c.QueueMax != 100 || c.IdleTimeout != 5*time.Minute || c.TestSource {
		t.Fatalf("padrões: %+v", c)
	}
	if c.LiveKitURL != "ws://127.0.0.1:7880" || c.YTDLP != "yt-dlp" || c.FFmpeg != "ffmpeg" || c.CacheDir == "" {
		t.Fatalf("padrões: %+v", c)
	}
	t.Setenv("MUSIC_MAX_PLAYERS", "2")
	t.Setenv("MUSIC_IDLE_TIMEOUT", "3s")
	t.Setenv("MUSIC_TEST_SOURCE", "1")
	c = ConfigFromEnv("7880")
	if c.MaxPlayers != 2 || c.IdleTimeout != 3*time.Second || !c.TestSource {
		t.Fatalf("env: %+v", c)
	}
}
