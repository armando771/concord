// AudioWorklet do voice mod: pitch shift, vibrato e modulação de amplitude (ver
// voiceModDsp.ts). Roda na thread de áudio e só recebe a mensagem pela porta.
import { VOICE_MOD_PROCESSOR, VoiceModDsp, type VoiceModWorkletMessage } from './voiceModDsp'

declare class AudioWorkletProcessor {
  readonly port: MessagePort
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void
declare const sampleRate: number

class ConcordVoiceModProcessor extends AudioWorkletProcessor {
  private dsp = new VoiceModDsp(sampleRate)

  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent<VoiceModWorkletMessage>) => {
      this.dsp.configure(event.data)
    }
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const output = outputs[0]?.[0]
    if (output) this.dsp.process(inputs[0]?.[0], output)
    return true
  }
}

registerProcessor(VOICE_MOD_PROCESSOR, ConcordVoiceModProcessor)
