package music

import (
	"os"
	"path/filepath"
	"strconv"
	"time"
)

type Config struct {
	YTDLP       string
	FFmpeg      string
	Cookies     string // MUSIC_YT_COOKIES: cookies de uma conta Premium (256 kbps)
	POTURL      string // MUSIC_POT_URL: provedor de PO token (bgutil, modo HTTP)
	CacheDir    string
	LiveKitURL  string
	MaxPlayers  int
	QueueMax    int
	IdleTimeout time.Duration
	TestSource  bool // MUSIC_TEST_SOURCE=1: tons do ffmpeg no lugar do YouTube
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v, err := strconv.Atoi(os.Getenv(key)); err == nil && v > 0 {
		return v
	}
	return def
}

func ConfigFromEnv(liveKitPort string) Config {
	idle, err := time.ParseDuration(os.Getenv("MUSIC_IDLE_TIMEOUT"))
	if err != nil || idle <= 0 {
		idle = 5 * time.Minute
	}
	return Config{
		YTDLP:       envOr("MUSIC_YTDLP", "yt-dlp"),
		FFmpeg:      envOr("MUSIC_FFMPEG", "ffmpeg"),
		Cookies:     os.Getenv("MUSIC_YT_COOKIES"),
		POTURL:      os.Getenv("MUSIC_POT_URL"),
		CacheDir:    envOr("MUSIC_CACHE_DIR", filepath.Join(os.TempDir(), "concord-music")),
		LiveKitURL:  "ws://127.0.0.1:" + liveKitPort,
		MaxPlayers:  envInt("MUSIC_MAX_PLAYERS", 5),
		QueueMax:    envInt("MUSIC_QUEUE_MAX", 100),
		IdleTimeout: idle,
		TestSource:  os.Getenv("MUSIC_TEST_SOURCE") == "1",
	}
}
