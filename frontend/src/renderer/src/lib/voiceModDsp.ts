// Núcleo do voice mod: pitch shift granular e modulação em anel.
//
// Auto-contido (sem DOM): roda dentro do AudioWorklet (voiceModWorklet.ts) e
// nos testes.
//
// Pitch shift: buffer circular com duas pontas de leitura defasadas em meia
// janela. O atraso de cada ponta varre a janela a (1 − razão) amostras por
// amostra, então a leitura avança `razão` amostras por amostra. As pontas se
// alternam com janelas sin² que somam 1 (sem tremor de volume). Com razão 1 a
// saída é a entrada atrasada em meia janela.

/** Nome do processador registrado pelo voiceModWorklet. */
export const VOICE_MOD_PROCESSOR = 'concord-voice-mod'

/** Janela do pitch shift. */
const WINDOW_MS = 50
/** Atraso fixo do caminho processado (meia janela); o caminho seco compensa. */
export const VOICE_MOD_LATENCY_MS = WINDOW_MS / 2

export interface VoiceModWorkletMessage {
  /** Razão de frequência (2 = uma oitava acima). */
  ratio: number
  /** Frequência da modulação em anel; 0 = desligada. */
  ringHz: number
}

function sinSquared(phase: number): number {
  const s = Math.sin(Math.PI * phase)
  return s * s
}

export class VoiceModDsp {
  ratio = 1
  ringHz = 0
  private readonly rate: number
  private readonly size: number
  private readonly buffer: Float32Array
  private pos = 0
  private phase = 0
  private ringPhase = 0

  constructor(rate: number) {
    this.rate = rate
    this.size = Math.round((rate * WINDOW_MS) / 1000)
    this.buffer = new Float32Array(this.size * 2 + 4)
  }

  process(input: Float32Array | undefined, output: Float32Array): void {
    const ringStep = (2 * Math.PI * this.ringHz) / this.rate
    for (let i = 0; i < output.length; i++) {
      this.buffer[this.pos] = input?.[i] ?? 0
      const phaseB = (this.phase + 0.5) % 1
      let y =
        this.read(this.phase * this.size) * sinSquared(this.phase) +
        this.read(phaseB * this.size) * sinSquared(phaseB)
      if (this.ringHz > 0) {
        y *= Math.sin(this.ringPhase)
        this.ringPhase = (this.ringPhase + ringStep) % (2 * Math.PI)
      }
      output[i] = y
      this.phase += (1 - this.ratio) / this.size
      this.phase -= Math.floor(this.phase)
      this.pos = (this.pos + 1) % this.buffer.length
    }
  }

  /** Lê o buffer `delay` amostras atrás da última escrita (interpolação linear). */
  private read(delay: number): number {
    const n = this.buffer.length
    const p = this.pos - delay
    const i0 = Math.floor(p)
    const frac = p - i0
    const a = this.buffer[((i0 % n) + n) % n]
    const b = this.buffer[(((i0 + 1) % n) + n) % n]
    return a + (b - a) * frac
  }
}
