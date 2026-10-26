// AudioWorklet do microfone: detecção de fala e portão de ruído (ver voiceActivity.ts).
// Roda na thread de áudio — não sofre o throttling de timers da janela em
// segundo plano (overlay de jogo) e só fala com a página quando muda.
//
// Com o portão ligado, o áudio sai com um atraso curto e multiplicado pelo
// ganho do portão, que abre quando a detecção acende e fecha depois do
// hangover. Desligado, o áudio passa direto.
import {
  createVoiceActivityState,
  GATE_ATTACK_MS,
  GATE_LOOKAHEAD_MS,
  GATE_RELEASE_MS,
  rmsDb,
  smoothingCoefficient,
  stepVoiceActivity,
  VOICE_ACTIVITY_DEFAULTS,
  VOICE_ACTIVITY_PROCESSOR,
  VOICE_ACTIVITY_WINDOW_MS,
  type VoiceActivityConfig,
  type VoiceActivitySettings
} from './voiceActivity'

declare class AudioWorkletProcessor {
  readonly port: MessagePort
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void
declare const sampleRate: number
declare const currentTime: number

class ConcordVoiceActivityProcessor extends AudioWorkletProcessor {
  private state = createVoiceActivityState()
  private config: VoiceActivityConfig = VOICE_ACTIVITY_DEFAULTS
  private gate = false
  private windowFrames = Math.round((sampleRate * VOICE_ACTIVITY_WINDOW_MS) / 1000)
  private sum = 0
  private frames = 0
  private speaking = false
  private line = new Float32Array(Math.round((sampleRate * GATE_LOOKAHEAD_MS) / 1000))
  private pos = 0
  private env = 0
  private target = 0
  private attack = smoothingCoefficient(GATE_ATTACK_MS, sampleRate)
  private release = smoothingCoefficient(GATE_RELEASE_MS, sampleRate)

  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent<VoiceActivitySettings>) => {
      if (event.data.gate && !this.gate) this.env = 0
      this.config = event.data.config
      this.gate = event.data.gate
    }
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0]
    const output = outputs[0]?.[0]
    const count = output?.length ?? input?.length ?? 0
    for (let i = 0; i < count; i++) {
      // Sem entrada (track parada ou desligada) conta como silêncio.
      const x = input?.[i] ?? 0
      this.sum += x * x
      this.frames++
      if (this.frames >= this.windowFrames) {
        this.decide((currentTime + i / sampleRate) * 1000)
      }
      const delayed = this.line[this.pos]
      this.line[this.pos] = x
      this.pos = (this.pos + 1) % this.line.length
      if (output) output[i] = this.gate ? delayed * this.envelope() : x
    }
    return true
  }

  private decide(nowMs: number): void {
    const speaking = stepVoiceActivity(this.state, rmsDb(this.sum, this.frames), nowMs, this.config)
    this.sum = 0
    this.frames = 0
    this.target = speaking ? 1 : 0
    if (speaking !== this.speaking) {
      this.speaking = speaking
      this.port.postMessage(speaking)
    }
  }

  private envelope(): number {
    const coefficient = this.target > this.env ? this.attack : this.release
    this.env += (this.target - this.env) * coefficient
    return this.env
  }
}

registerProcessor(VOICE_ACTIVITY_PROCESSOR, ConcordVoiceActivityProcessor)
