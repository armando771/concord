// AudioWorklet: toca o PCM que o helper nativo manda (som da janela
// compartilhada). Roda na thread de áudio, separado do resto do app.
import { PcmRing } from './pcmRing'

declare class AudioWorkletProcessor {
  readonly port: MessagePort
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void

const SAMPLE_RATE = 48_000

class ConcordPcmProcessor extends AudioWorkletProcessor {
  // 1 s de buffer; mais de 150 ms de atraso é descartado
  private ring = new PcmRing(SAMPLE_RATE, Math.round(SAMPLE_RATE * 0.15))

  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      this.ring.push(new Float32Array(event.data))
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const [left, right] = outputs[0]
    this.ring.pull(left, right ?? new Float32Array(left.length))
    return true
  }
}

registerProcessor('concord-pcm', ConcordPcmProcessor)
