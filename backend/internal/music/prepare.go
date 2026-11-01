package music

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const (
	targetLUFS  = -14.0 // mesmo alvo do Spotify
	maxTruePeak = -1.0
	maxBoostDB  = 12.0
)

type Analysis struct {
	IntegratedLUFS float64
	TruePeakDB     float64
	// StartSec/EndSec: onde a música de fato começa/termina (0 = sem corte).
	StartSec float64
	EndSec   float64
}

var (
	reIntegrated   = regexp.MustCompile(`I:\s+(-?[\d.]+|-inf) LUFS`)
	rePeak         = regexp.MustCompile(`Peak:\s+(-?[\d.]+|-inf) dBFS`)
	reSilenceStart = regexp.MustCompile(`silence_start: (-?[\d.]+)`)
	reSilenceEnd   = regexp.MustCompile(`silence_end: (-?[\d.]+)`)
	reDuration     = regexp.MustCompile(`Duration: (\d+):(\d+):(\d+(?:\.\d+)?)`)
)

func parseNum(s string) float64 {
	if s == "-inf" {
		return -70
	}
	v, _ := strconv.ParseFloat(s, 64)
	return v
}

// ParseAnalysis lê o stderr do ffmpeg com ebur128 + silencedetect.
func ParseAnalysis(stderr string) (Analysis, error) {
	i := strings.LastIndex(stderr, "Summary:")
	if i < 0 {
		return Analysis{}, errors.New("ffmpeg não devolveu o resumo do ebur128")
	}
	summary := stderr[i:]
	var a Analysis
	m := reIntegrated.FindStringSubmatch(summary)
	if m == nil {
		return Analysis{}, errors.New("loudness integrada ausente")
	}
	a.IntegratedLUFS = parseNum(m[1])
	if p := rePeak.FindStringSubmatch(summary); p != nil {
		a.TruePeakDB = parseNum(p[1])
	}

	// Silêncio que começa no 0 marca o início; o último silence_start sem
	// silence_end depois dele é o silêncio do fim.
	body := stderr[:i]
	var duration float64
	if d := reDuration.FindStringSubmatch(stderr); d != nil {
		h, _ := strconv.ParseFloat(d[1], 64)
		m, _ := strconv.ParseFloat(d[2], 64)
		duration = h*3600 + m*60 + parseNum(d[3])
	}
	starts := reSilenceStart.FindAllStringSubmatchIndex(body, -1)
	ends := reSilenceEnd.FindAllStringSubmatchIndex(body, -1)
	if len(starts) > 0 && parseNum(body[starts[0][2]:starts[0][3]]) <= 0.1 && len(ends) > 0 {
		a.StartSec = parseNum(body[ends[0][2]:ends[0][3]])
	}
	if len(starts) > 0 {
		last := starts[len(starts)-1]
		// O ffmpeg real fecha o último silêncio com um silence_end no fim do
		// arquivo, então ele também conta como final se terminar na duração.
		openAtEnd := true
		for _, e := range ends {
			if e[0] > last[0] {
				openAtEnd = duration > 0 && parseNum(body[e[2]:e[3]]) >= duration-0.1
				break
			}
		}
		if openAtEnd {
			if v := parseNum(body[last[2]:last[3]]); v > a.StartSec {
				a.EndSec = v
			}
		}
	}
	return a, nil
}

// GainDB: ganho fixo até -14 LUFS, sem passar de -1 dBTP nem de +12 dB.
func GainDB(a Analysis) float64 {
	g := targetLUFS - a.IntegratedLUFS
	if a.TruePeakDB+g > maxTruePeak {
		g = maxTruePeak - a.TruePeakDB
	}
	return math.Min(g, maxBoostDB)
}

func AnalyzeArgs(path string) []string {
	return []string{"-hide_banner", "-nostats", "-i", path,
		"-af", "silencedetect=noise=-60dB:d=0.5,ebur128=peak=true", "-f", "null", "-"}
}

// DecodeArgs: at é a posição de onde tocar, contada do primeiro som (a
// retomada depois de reiniciar o servidor); 0 = do começo.
func DecodeArgs(path string, a Analysis, at time.Duration) []string {
	args := []string{"-hide_banner", "-loglevel", "error"}
	if start := a.StartSec + at.Seconds(); start > 0 {
		args = append(args, "-ss", fmt.Sprintf("%.3f", start))
	}
	if a.EndSec > 0 {
		args = append(args, "-to", fmt.Sprintf("%.3f", a.EndSec))
	}
	return append(args, "-i", path,
		"-af", fmt.Sprintf("volume=%.2fdB", GainDB(a)),
		"-f", "f32le", "-ar", "48000", "-ac", "2", "pipe:1")
}

type Preparer struct {
	ffmpeg string
	run    Runner
}

func NewPreparer(ffmpeg string, run Runner) *Preparer { return &Preparer{ffmpeg: ffmpeg, run: run} }

// Prepare mede a faixa e devolve o PCM já com ganho e sem silêncio nas
// pontas, a partir de at (ver DecodeArgs).
func (p *Preparer) Prepare(ctx context.Context, path string, at time.Duration) (io.ReadCloser, error) {
	_, stderr, err := p.run(ctx, p.ffmpeg, AnalyzeArgs(path)...)
	if err != nil {
		return nil, fmt.Errorf("análise: %v: %s", err, lastLine(string(stderr)))
	}
	a, err := ParseAnalysis(string(stderr))
	if err != nil {
		return nil, err
	}
	cmd := exec.CommandContext(ctx, p.ffmpeg, DecodeArgs(path, a, at)...)
	out, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	return &procReader{ReadCloser: out, cmd: cmd}, nil
}

// procReader fecha o pipe e mata o ffmpeg (skip no meio da música).
type procReader struct {
	io.ReadCloser
	cmd *exec.Cmd
}

func (r *procReader) Close() error {
	_ = r.ReadCloser.Close()
	if r.cmd.Process != nil {
		_ = r.cmd.Process.Kill()
	}
	_ = r.cmd.Wait()
	return nil
}

func lastLine(s string) string {
	lines := strings.Split(strings.TrimSpace(s), "\n")
	return lines[len(lines)-1]
}
