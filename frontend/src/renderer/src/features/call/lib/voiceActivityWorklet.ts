// AudioWorklet do microfone: detecção de fala e portão de ruído (o laço está
// em voiceActivityGate.ts). Roda na thread de áudio — não sofre o throttling
// de timers da janela em segundo plano (overlay de jogo) e só fala com a
// página quando muda.
import { VOICE_ACTIVITY_PROCESSOR, type VoiceActivitySettings } from './voiceActivity'
import { VoiceActivityGate, type VoiceActivityProcessor } from './voiceActivityGate'

declare class AudioWorkletProcessor {
  readonly port: MessagePort
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void
declare const sampleRate: number
declare const currentTime: number

class ConcordVoiceActivityProcessor extends AudioWorkletProcessor {
  private gate: VoiceActivityProcessor = new VoiceActivityGate(sampleRate)

  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent<VoiceActivitySettings>) => {
      this.gate.configure(event.data)
    }
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const change = this.gate.process(inputs[0]?.[0], outputs[0]?.[0], currentTime)
    if (change !== null) this.port.postMessage(change)
    return true
  }
}

registerProcessor(VOICE_ACTIVITY_PROCESSOR, ConcordVoiceActivityProcessor)
