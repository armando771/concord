// Laço por amostra do worklet do microfone (voiceActivityWorklet.ts): detecção
// de fala (máquina de estados de voiceActivity.ts) e portão de ruído.
//
// Com o portão ligado, o áudio sai com um atraso curto e multiplicado pelo
// ganho do portão, que abre quando a detecção acende e fecha depois do
// hangover. Desligado, o áudio passa direto.
//
// Auto-contido (sem DOM): roda dentro do AudioWorklet e nos testes.
import {
  createVoiceActivityState,
  GATE_ATTACK_MS,
  GATE_LOOKAHEAD_MS,
  GATE_RELEASE_MS,
  rmsDb,
  smoothingCoefficient,
  stepVoiceActivity,
  VOICE_ACTIVITY_DEFAULTS,
  VOICE_ACTIVITY_WINDOW_MS,
  type VoiceActivityConfig,
  type VoiceActivitySettings
} from './voiceActivity'

/** O que o worklet do microfone usa por bloco (implementado em JS ou em WASM). */
export interface VoiceActivityProcessor {
  configure: (settings: VoiceActivitySettings) => void
  /**
   * Um bloco a partir de `currentTime` (s). Devolve `true`/`false` quando a
   * fala começou/terminou neste bloco, `null` se nada mudou.
   */
  process: (
    input: Float32Array | undefined,
    output: Float32Array | undefined,
    currentTime: number
  ) => boolean | null
}

export class VoiceActivityGate implements VoiceActivityProcessor {
  private state = createVoiceActivityState()
  private config: VoiceActivityConfig = VOICE_ACTIVITY_DEFAULTS
  private gate = false
  private readonly rate: number
  private readonly windowFrames: number
  private sum = 0
  private frames = 0
  private speaking = false
  private readonly line: Float32Array
  private pos = 0
  private env = 0
  private target = 0
  private readonly attack: number
  private readonly release: number

  constructor(rate: number) {
    this.rate = rate
    this.windowFrames = Math.round((rate * VOICE_ACTIVITY_WINDOW_MS) / 1000)
    this.line = new Float32Array(Math.round((rate * GATE_LOOKAHEAD_MS) / 1000))
    this.attack = smoothingCoefficient(GATE_ATTACK_MS, rate)
    this.release = smoothingCoefficient(GATE_RELEASE_MS, rate)
  }

  configure(settings: VoiceActivitySettings): void {
    if (settings.gate && !this.gate) this.env = 0
    this.config = settings.config
    this.gate = settings.gate
  }

  process(
    input: Float32Array | undefined,
    output: Float32Array | undefined,
    currentTime: number
  ): boolean | null {
    const count = output?.length ?? input?.length ?? 0
    let change: boolean | null = null
    for (let i = 0; i < count; i++) {
      // Sem entrada (track parada ou desligada) conta como silêncio.
      const x = input?.[i] ?? 0
      this.sum += x * x
      this.frames++
      if (this.frames >= this.windowFrames) {
        change = this.decide((currentTime + i / this.rate) * 1000) ?? change
      }
      const delayed = this.line[this.pos]
      this.line[this.pos] = x
      this.pos = this.pos + 1 === this.line.length ? 0 : this.pos + 1
      if (output) output[i] = this.gate ? delayed * this.envelope() : x
    }
    return change
  }

  private decide(nowMs: number): boolean | null {
    const speaking = stepVoiceActivity(this.state, rmsDb(this.sum, this.frames), nowMs, this.config)
    this.sum = 0
    this.frames = 0
    this.target = speaking ? 1 : 0
    if (speaking === this.speaking) return null
    this.speaking = speaking
    return speaking
  }

  private envelope(): number {
    const coefficient = this.target > this.env ? this.attack : this.release
    this.env += (this.target - this.env) * coefficient
    return this.env
  }
}
