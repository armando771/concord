import { beforeAll, describe, expect, it, vi } from 'vitest'
import { VOICE_MOD_PROCESSOR, type VoiceModWorkletMessage } from './voiceModDsp'

const RATE = 48_000
const BLOCK = 128

interface Processor {
  port: { onmessage: ((event: { data: VoiceModWorkletMessage }) => void) | null }
  process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean
}

let Processor: new () => Processor
let registeredName = ''

beforeAll(async () => {
  vi.stubGlobal(
    'AudioWorkletProcessor',
    class {
      port = { onmessage: null }
    }
  )
  vi.stubGlobal('sampleRate', RATE)
  vi.stubGlobal('registerProcessor', (name: string, ctor: new () => Processor) => {
    registeredName = name
    Processor = ctor
  })
  await import('./voiceModWorklet')
})

function run(processor: Processor, input: Float32Array): Float32Array {
  const out = new Float32Array(input.length)
  for (let i = 0; i < input.length; i += BLOCK) {
    const block = new Float32Array(BLOCK)
    processor.process([[input.subarray(i, i + BLOCK)]], [[block]])
    out.set(block, i)
  }
  return out
}

function sine(hz: number): Float32Array {
  return Float32Array.from({ length: RATE }, (_, i) => 0.5 * Math.sin((2 * Math.PI * hz * i) / RATE))
}

function frequency(out: Float32Array): number {
  const from = Math.round(RATE * 0.25)
  let crossings = 0
  for (let i = from + 1; i < out.length; i++) if (out[i - 1] < 0 && out[i] >= 0) crossings++
  return crossings / ((out.length - from) / RATE)
}

describe('voiceModWorklet', () => {
  it('registra o processador com o nome combinado', () => {
    expect(registeredName).toBe(VOICE_MOD_PROCESSOR)
  })

  it('aplica a razão recebida pela porta', () => {
    const processor = new Processor()
    processor.port.onmessage!({
      data: { ratio: 2, modHz: 0, modDepth: 0, vibratoHz: 0, vibratoSemitones: 0 }
    })
    expect(frequency(run(processor, sine(1000)))).toBeCloseTo(2000, -2)
  })

  it('sem entrada devolve silêncio e continua vivo', () => {
    const processor = new Processor()
    const block = new Float32Array(BLOCK)
    expect(processor.process([[]], [[block]])).toBe(true)
    expect(block.every((v) => v === 0)).toBe(true)
  })
})
