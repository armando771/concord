package music

import (
	"context"
	"io"
	"math"
	"os/exec"
	"strings"
	"testing"
	"time"
)

const sampleAnalysis = `[silencedetect @ 0x1] silence_start: 0
[silencedetect @ 0x1] silence_end: 1.25 | silence_duration: 1.25
[silencedetect @ 0x1] silence_start: 90.5
[silencedetect @ 0x1] silence_end: 91.0 | silence_duration: 0.5
[silencedetect @ 0x1] silence_start: 210.75
[Parsed_ebur128_0 @ 0x2] Summary:

  Integrated loudness:
    I:          -9.6 LUFS
    Threshold: -19.8 LUFS

  Loudness range:
    LRA:         6.1 LU

  True peak:
    Peak:        0.4 dBFS
`

func TestParseAnalysis(t *testing.T) {
	a, err := ParseAnalysis(sampleAnalysis)
	if err != nil {
		t.Fatal(err)
	}
	if a.IntegratedLUFS != -9.6 || a.TruePeakDB != 0.4 || a.StartSec != 1.25 || a.EndSec != 210.75 {
		t.Fatalf("a = %+v", a)
	}
}

func TestParseAnalysisNoSilence(t *testing.T) {
	a, err := ParseAnalysis("Summary:\n I: -14.0 LUFS\n Peak: -1.5 dBFS\n")
	if err != nil || a.StartSec != 0 || a.EndSec != 0 {
		t.Fatalf("a=%+v err=%v", a, err)
	}
	if _, err := ParseAnalysis("nada aqui"); err == nil {
		t.Fatal("sem Summary deve falhar")
	}
}

func TestGainDB(t *testing.T) {
	// Música alta (-9.6 LUFS): baixa para -14 (-4.4 dB).
	if g := GainDB(Analysis{IntegratedLUFS: -9.6, TruePeakDB: 0.4}); math.Abs(g-(-4.4)) > 1e-9 {
		t.Fatalf("g = %v", g)
	}
	// Música baixa com pico alto: sobe só até o pico ficar em -1 dBTP.
	if g := GainDB(Analysis{IntegratedLUFS: -20, TruePeakDB: -3}); math.Abs(g-2) > 1e-9 {
		t.Fatalf("g = %v", g)
	}
	// Quase silêncio: nunca mais que +12 dB.
	if g := GainDB(Analysis{IntegratedLUFS: -70, TruePeakDB: -60}); g != 12 {
		t.Fatalf("g = %v", g)
	}
}

func TestDecodeArgs(t *testing.T) {
	args := strings.Join(DecodeArgs("/c/a.webm", Analysis{IntegratedLUFS: -9.6, TruePeakDB: 0.4, StartSec: 1.25, EndSec: 210.75}, 0), " ")
	for _, want := range []string{"-ss 1.250", "-to 210.750", "-i /c/a.webm", "volume=-4.40dB", "-f f32le", "-ar 48000", "-ac 2", "pipe:1"} {
		if !strings.Contains(args, want) {
			t.Errorf("faltou %q em %q", want, args)
		}
	}
	plain := strings.Join(DecodeArgs("/c/a.webm", Analysis{IntegratedLUFS: -14, TruePeakDB: -2}, 0), " ")
	if strings.Contains(plain, "-ss") || strings.Contains(plain, "-to") {
		t.Errorf("sem silêncio não corta: %q", plain)
	}
}

// Retomada depois de reiniciar: o seek soma a posição salva ao corte do
// silêncio do começo (a posição conta do primeiro som).
func TestDecodeArgsResumeSeeks(t *testing.T) {
	cases := []struct {
		a    Analysis
		at   time.Duration
		want string
	}{
		{Analysis{StartSec: 1.25, EndSec: 210.75}, 90 * time.Second, "-ss 91.250"},
		{Analysis{}, 30500 * time.Millisecond, "-ss 30.500"},
	}
	for _, c := range cases {
		args := strings.Join(DecodeArgs("/c/a.webm", c.a, c.at), " ")
		if !strings.Contains(args, c.want+" ") || strings.Count(args, "-ss") != 1 {
			t.Errorf("DecodeArgs(%+v, %v) = %q, want %q", c.a, c.at, args, c.want)
		}
	}
}

// Integração com o ffmpeg real (pula se não estiver instalado).
func TestPrepareWithFFmpeg(t *testing.T) {
	ff, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg não instalado")
	}
	dir := t.TempDir()
	src := dir + "/tom.opus"
	if out, err := exec.Command(ff, "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-ac", "2", "-c:a", "libopus", src).CombinedOutput(); err != nil {
		t.Fatalf("%v: %s", err, out)
	}
	r, err := NewPreparer(ff, ExecRunner).Prepare(context.Background(), src, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	data, err := io.ReadAll(r)
	if err != nil {
		t.Fatal(err)
	}
	// ~2 s de f32le estéreo 48 kHz = 2*48000*2*4 bytes (com folga do encoder).
	if len(data) < 600_000 || len(data)%8 != 0 {
		t.Fatalf("bytes = %d", len(data))
	}
}

const realAnalysis = `Input #0, matroska,webm, from 'a.webm':
  Duration: 00:00:06.00, start: 0.000000, bitrate: 50 kb/s
[Parsed_silencedetect_0 @ 000001211e636780] silence_start: 0
[Parsed_silencedetect_0 @ 000001211e636780] silence_end: 0.997833 | silence_duration: 0.997833
[Parsed_silencedetect_0 @ 000001211e636780] silence_start: 4.080146
[Parsed_silencedetect_0 @ 000001211e636780] silence_end: 6 | silence_duration: 1.919854
[Parsed_ebur128_1 @ 0x2] Summary:

  Integrated loudness:
    I:         -20.0 LUFS

  True peak:
    Peak:       -3.0 dBFS
`

// O ffmpeg real emite silence_end no fim do arquivo; o silêncio final ainda deve ser cortado.
func TestParseAnalysisTrailingSilenceWithEnd(t *testing.T) {
	a, err := ParseAnalysis(realAnalysis)
	if err != nil {
		t.Fatal(err)
	}
	if math.Abs(a.StartSec-0.997833) > 1e-6 || math.Abs(a.EndSec-4.080146) > 1e-6 {
		t.Fatalf("a = %+v", a)
	}
}

func TestParseAnalysisLeadingSilenceTolerance(t *testing.T) {
	in := "[silencedetect @ 0x1] silence_start: 0.0065\n[silencedetect @ 0x1] silence_end: 1.5 | silence_duration: 1.49\nSummary:\n I: -14.0 LUFS\n Peak: -2.0 dBFS\n"
	a, err := ParseAnalysis(in)
	if err != nil || a.StartSec != 1.5 {
		t.Fatalf("a=%+v err=%v", a, err)
	}
}

// 1 s de silêncio + 2 s de tom + 2 s de silêncio: o PCM tem que sair bem menor que 5 s.
func TestPrepareTrimsSilenceWithFFmpeg(t *testing.T) {
	ff, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg não instalado")
	}
	src := t.TempDir() + "/mix.opus"
	out, err := exec.Command(ff, "-hide_banner", "-loglevel", "error",
		"-f", "lavfi", "-t", "1", "-i", "anullsrc=r=48000:cl=stereo",
		"-f", "lavfi", "-t", "2", "-i", "sine=frequency=440:sample_rate=48000",
		"-f", "lavfi", "-t", "2", "-i", "anullsrc=r=48000:cl=stereo",
		"-filter_complex", "[1:a]aformat=channel_layouts=stereo[t];[0:a][t][2:a]concat=n=3:v=0:a=1",
		"-c:a", "libopus", src).CombinedOutput()
	if err != nil {
		t.Fatalf("%v: %s", err, out)
	}
	r, err := NewPreparer(ff, ExecRunner).Prepare(context.Background(), src, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	data, err := io.ReadAll(r)
	if err != nil {
		t.Fatal(err)
	}
	// 3,5 s = 3.5*48000*8 bytes; sem corte seriam ~5 s (1.92 MB).
	if len(data) == 0 || len(data) >= 1_344_000 {
		t.Fatalf("bytes = %d", len(data))
	}
}
