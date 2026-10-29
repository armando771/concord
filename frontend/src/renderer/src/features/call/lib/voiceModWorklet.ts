// AudioWorklet do voice mod: pitch shift, vibrato e modulação de amplitude (ver
// voiceModDsp.ts). Roda na thread de áudio e só recebe a mensagem pela porta.
// Com o módulo WASM em `processorOptions.dspModule` (dspModule.ts) o laço roda
// em Rust; sem ele, ou se não instanciar, no JS — o som é o mesmo.
import {
  VOICE_MOD_PROCESSOR,
  VOICE_MOD_STOP,
  VoiceModDsp,
  type VoiceModPortMessage,
  type VoiceModProcessor
} from './voiceModDsp'
import { VoiceModWasm } from './voiceModWasm'

declare class AudioWorkletProcessor {
  readonly port: MessagePort
}
declare function registerProcessor(
  name: string,
  ctor: new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor
): void
declare const sampleRate: number

class ConcordVoiceModProcessor extends AudioWorkletProcessor {
  private dsp: VoiceModProcessor
  private stopped = false
  /** Qual implementação está rodando (diagnóstico e testes). */
  readonly engine: 'wasm' | 'js'

  constructor(options?: AudioWorkletNodeOptions) {
    super()
    const wasm = VoiceModWasm.create(sampleRate, options?.processorOptions?.dspModule)
    this.dsp = wasm ?? new VoiceModDsp(sampleRate)
    this.engine = wasm ? 'wasm' : 'js'
    this.port.onmessage = (event: MessageEvent<VoiceModPortMessage>) => {
      if (event.data === VOICE_MOD_STOP) this.stopped = true
      else this.dsp.configure(event.data)
    }
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    if (this.stopped) return false
    const output = outputs[0]?.[0]
    if (output) this.dsp.process(inputs[0]?.[0], output)
    return true
  }
}

registerProcessor(VOICE_MOD_PROCESSOR, ConcordVoiceModProcessor)
