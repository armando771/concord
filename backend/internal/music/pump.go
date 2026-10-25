package music

import (
	"context"
	"encoding/binary"
	"io"
	"math"
	"time"
)

type Clock interface {
	Now() time.Time
	Sleep(d time.Duration)
}

type RealClock struct{}

func (RealClock) Now() time.Time        { return time.Now() }
func (RealClock) Sleep(d time.Duration) { time.Sleep(d) }

// Pump entrega o áudio ao encoder no ritmo do relógio, no máximo `lead` à
// frente: com pouca coisa nos pipes, o skip e o crossfade respondem na hora.
func Pump(ctx context.Context, src FrameSource, w io.Writer, clk Clock, lead time.Duration) error {
	frame := make([]float32, FrameLen)
	out := make([]byte, FrameLen*4)
	start := clk.Now()
	var frames int64
	for ctx.Err() == nil {
		due := start.Add(time.Duration(frames) * FrameDuration)
		now := clk.Now()
		if ahead := due.Sub(now); ahead > lead {
			clk.Sleep(ahead - lead)
		} else if now.Sub(due) > time.Second {
			// Ficou muito para trás (máquina travou): recomeça a contagem em vez
			// de despejar uma rajada de áudio.
			start = now.Add(-time.Duration(frames) * FrameDuration)
		}
		src.ReadFrame(frame)
		for i, v := range frame {
			binary.LittleEndian.PutUint32(out[i*4:], math.Float32bits(v))
		}
		if _, err := w.Write(out); err != nil {
			return err
		}
		frames++
	}
	return ctx.Err()
}
