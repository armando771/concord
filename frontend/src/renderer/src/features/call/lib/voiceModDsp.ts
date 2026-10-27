// Núcleo do voice mod: pitch shift granular (com vibrato) e modulação de
// amplitude (anel ou tremolo).
//
// Auto-contido (sem DOM): roda dentro do AudioWorklet (voiceModWorklet.ts) e
// nos testes.
//
// Pitch shift: buffer circular com duas pontas de leitura defasadas em meia
// janela. O atraso de cada ponta varre a janela a (1 − razão) amostras por
// amostra, então a leitura avança `razão` amostras por amostra. As pontas se
// alternam com janelas sin² que somam 1 (sem tremor de volume). Com razão 1 a
// saída é a entrada atrasada em meia janela.
//
// Vibrato: a razão oscila por bloco (128 amostras) em torno da razão base;
// barato e, como a fase acumula, sem degraus audíveis.
//
// Modulação de amplitude: ganho 1 − d + d·sen. Com d = 1 é anel (Robô); com
// d ≤ 0,5 o ganho fica entre 1 − 2d e 1, um tremolo.

/** Nome do processador registrado pelo voiceModWorklet. */
export const VOICE_MOD_PROCESSOR = 'concord-voice-mod'

/** Janela do pitch shift. */
const WINDOW_MS = 50
/** Atraso fixo do caminho processado (meia janela); o caminho seco compensa. */
export const VOICE_MOD_LATENCY_MS = WINDOW_MS / 2

export interface VoiceModWorkletMessage {
  /** Razão de frequência (2 = uma oitava acima). */
  ratio: number
  /** Frequência da modulação de amplitude; 0 = desligada. */
  modHz: number
  /** 1 = anel (multiplica por um seno); menos = tremolo. */
  modDepth: number
  /** Frequência do vibrato; 0 = desligado. */
  vibratoHz: number
  /** Amplitude do vibrato, em semitons. */
  vibratoSemitones: number
}

/** O que o worklet usa por bloco: este VoiceModDsp (JS) ou o VoiceModWasm. */
export interface VoiceModProcessor {
  configure: (message: VoiceModWorkletMessage) => void
  process: (input: Float32Array | undefined, output: Float32Array) => void
}

const TWO_PI = 2 * Math.PI

export class VoiceModDsp implements VoiceModWorkletMessage, VoiceModProcessor {
  ratio = 1
  modHz = 0
  modDepth = 0
  vibratoHz = 0
  vibratoSemitones = 0
  private readonly rate: number
  private readonly size: number
  private readonly buffer: Float32Array
  private pos = 0
  private phase = 0
  private modPhase = 0
  private vibratoPhase = 0

  constructor(rate: number) {
    this.rate = rate
    this.size = Math.round((rate * WINDOW_MS) / 1000)
    this.buffer = new Float32Array(this.size * 2 + 4)
  }

  configure(message: VoiceModWorkletMessage): void {
    this.ratio = message.ratio
    this.modHz = message.modHz
    this.modDepth = message.modDepth
    this.vibratoHz = message.vibratoHz
    this.vibratoSemitones = message.vibratoSemitones
  }

  process(input: Float32Array | undefined, output: Float32Array): void {
    const step = (1 - this.blockRatio(output.length)) / this.size
    const modStep = (TWO_PI * this.modHz) / this.rate
    for (let i = 0; i < output.length; i++) {
      this.buffer[this.pos] = input?.[i] ?? 0
      // As pontas estão meia janela defasadas: a janela da segunda é
      // sen²(π(p + ½)) = cos²(πp) = 1 − sen²(πp). Um seno por amostra.
      const s = Math.sin(Math.PI * this.phase)
      const weightA = s * s
      const phaseB = (this.phase + 0.5) % 1
      let y =
        this.read(this.phase * this.size) * weightA + this.read(phaseB * this.size) * (1 - weightA)
      if (this.modHz > 0) {
        y *= 1 - this.modDepth + this.modDepth * Math.sin(this.modPhase)
        this.modPhase = (this.modPhase + modStep) % TWO_PI
      }
      output[i] = y
      this.phase += step
      this.phase -= Math.floor(this.phase)
      this.pos = this.pos + 1 === this.buffer.length ? 0 : this.pos + 1
    }
  }

  /** Razão deste bloco: a base com o desvio do vibrato; avança a fase dele. */
  private blockRatio(samples: number): number {
    const ratio = this.ratio * 2 ** ((this.vibratoSemitones * Math.sin(this.vibratoPhase)) / 12)
    const step = (TWO_PI * this.vibratoHz * samples) / this.rate
    this.vibratoPhase = (this.vibratoPhase + step) % TWO_PI
    return ratio
  }

  /** Lê o buffer `delay` amostras atrás da última escrita (interpolação linear). */
  private read(delay: number): number {
    const n = this.buffer.length
    const p = this.pos - delay
    const floor = Math.floor(p)
    const frac = p - floor
    // delay ∈ [0, janela): o índice cai em [−janela, n), uma volta basta (sem %).
    const i0 = floor < 0 ? floor + n : floor
    const a = this.buffer[i0]
    const b = this.buffer[i0 + 1 === n ? 0 : i0 + 1]
    return a + (b - a) * frac
  }
}
