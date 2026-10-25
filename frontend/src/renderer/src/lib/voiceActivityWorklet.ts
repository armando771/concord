// AudioWorklet: detecção de fala do próprio microfone (ver voiceActivity.ts).
// Roda na thread de áudio — não sofre o throttling de timers da janela em
// segundo plano (overlay de jogo) e só fala com a página quando muda.
import {
  createVoiceActivityState,
  rmsDb,
  stepVoiceActivity,
  VOICE_ACTIVITY_PROCESSOR,
  VOICE_ACTIVITY_WINDOW_MS
} from './voiceActivity'

declare class AudioWorkletProcessor {
  readonly port: MessagePort
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void
declare const sampleRate: number
declare const currentTime: number

class ConcordVoiceActivityProcessor extends AudioWorkletProcessor {
  private state = createVoiceActivityState()
  private windowFrames = Math.round((sampleRate * VOICE_ACTIVITY_WINDOW_MS) / 1000)
  private sum = 0
  private frames = 0
  private speaking = false

  process(inputs: Float32Array[][]): boolean {
    // Sem entrada (track parada ou desligada) conta como silêncio.
    const channel = inputs[0]?.[0]
    if (channel) {
      let sum = 0
      for (let i = 0; i < channel.length; i++) sum += channel[i] * channel[i]
      this.sum += sum
      this.frames += channel.length
    } else {
      this.frames += 128
    }
    if (this.frames >= this.windowFrames) {
      const speaking = stepVoiceActivity(
        this.state,
        rmsDb(this.sum, this.frames),
        currentTime * 1000
      )
      this.sum = 0
      this.frames = 0
      if (speaking !== this.speaking) {
        this.speaking = speaking
        this.port.postMessage(speaking)
      }
    }
    return true
  }
}

registerProcessor(VOICE_ACTIVITY_PROCESSOR, ConcordVoiceActivityProcessor)
