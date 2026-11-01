// Voice mod em WASM: o mesmo algoritmo de voiceModDsp.ts portado para Rust
// (native/concord-dsp/src/voice_mod.rs). O worklet usa este quando a página
// manda o módulo; senão, ou se ele falhar, usa o VoiceModDsp em JS.
import { chunkOf, DspIo, instantiateDsp, type DspExports } from './dspWasm'
import type { VoiceModProcessor, VoiceModWorkletMessage } from './voiceModDsp'

export class VoiceModWasm implements VoiceModProcessor {
  private readonly io: DspIo

  private constructor(private readonly dsp: DspExports) {
    this.io = new DspIo(dsp)
  }

  /** `null` sem módulo, se ele não instancia ou se a taxa não é suportada. */
  static create(rate: number, module: unknown): VoiceModWasm | null {
    const dsp = instantiateDsp(module)
    return dsp && dsp.vm_init(rate) === 1 ? new VoiceModWasm(dsp) : null
  }

  configure(message: VoiceModWorkletMessage): void {
    this.dsp.vm_configure(
      message.ratio,
      message.modHz,
      message.modDepth,
      message.vibratoHz,
      message.vibratoSemitones
    )
  }

  process(input: Float32Array | undefined, output: Float32Array): void {
    const capacity = this.io.capacity
    for (let offset = 0; offset < output.length; offset += capacity) {
      const n = Math.min(capacity, output.length - offset)
      this.dsp.vm_process(n, this.io.write(chunkOf(input, offset, n), n))
      this.io.read(chunkOf(output, offset, n))
    }
  }
}
