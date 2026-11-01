import { beforeAll, describe, expect, it, vi } from 'vitest'
import { voiceActivityFor, type VoiceActivitySettings } from './voiceActivity'

// ─── O worklet de verdade, num AudioWorklet simulado ────────────────────────

const RATE = 48_000
const BLOCK = 128
/** Atraso do portão (GATE_LOOKAHEAD_MS = 40 ms). */
const LOOKAHEAD = Math.round(RATE * 0.04)

let clock = 0

interface Processor {
  port: {
    onmessage: ((event: { data: VoiceActivitySettings }) => void) | null
    postMessage: ReturnType<typeof vi.fn>
  }
  process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean
}

let Processor: new () => Processor

beforeAll(async () => {
  vi.stubGlobal(
    'AudioWorkletProcessor',
    class {
      port = { onmessage: null, postMessage: vi.fn() }
    }
  )
  vi.stubGlobal('sampleRate', RATE)
  Object.defineProperty(globalThis, 'currentTime', { get: () => clock, configurable: true })
  vi.stubGlobal('registerProcessor', (_: string, ctor: new () => Processor) => {
    Processor = ctor
  })
  await import('./voiceActivityWorklet')
})

function make(settings: VoiceActivitySettings): Processor {
  const processor = new Processor()
  processor.port.onmessage!({ data: settings })
  return processor
}

/** Passa o sinal em blocos de 128 amostras, como o áudio real, e devolve a saída. */
function run(processor: Processor, input: Float32Array): Float32Array {
  const out = new Float32Array(input.length)
  for (let i = 0; i < input.length; i += BLOCK) {
    const block = new Float32Array(BLOCK)
    processor.process([[input.subarray(i, i + BLOCK)]], [[block]])
    out.set(block, i)
    clock += BLOCK / RATE
  }
  return out
}

/** Tamanho em amostras, sempre em blocos inteiros. */
function samples(seconds: number): number {
  return Math.round((seconds * RATE) / BLOCK) * BLOCK
}

/** Senoide de 1 kHz. */
function tone(seconds: number, amplitude: number): Float32Array {
  const out = new Float32Array(samples(seconds))
  for (let i = 0; i < out.length; i++) {
    out[i] = amplitude * Math.sin((2 * Math.PI * 1000 * i) / RATE)
  }
  return out
}

function silence(seconds: number): Float32Array {
  return new Float32Array(samples(seconds))
}

function concat(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

describe('voiceActivityWorklet — portão desligado', () => {
  it('o áudio passa direto, sem atraso', () => {
    const processor = make({ config: voiceActivityFor(60), gate: false })
    const input = tone(0.2, 0.3)
    expect(run(processor, input)).toEqual(input)
  })
})

describe('voiceActivityWorklet — portão ligado', () => {
  it('silêncio não sai', () => {
    const processor = make({ config: voiceActivityFor(60), gate: true })
    expect(run(processor, silence(0.3)).every((v) => v === 0)).toBe(true)
  })

  it('a fala sai inteira, atrasada, sem cortar o começo', () => {
    const processor = make({ config: voiceActivityFor(60), gate: true })
    const speech = tone(0.5, 0.3)
    const input = concat(silence(0.2), speech, silence(0.1))
    const out = run(processor, input)
    const start = Math.round(0.2 * RATE)
    for (let k = 0; k < speech.length; k += 97) {
      expect(out[start + LOOKAHEAD + k]).toBeCloseTo(input[start + k], 2)
    }
  })

  it('fecha depois da fala: ruído baixo que vem depois não passa', () => {
    const processor = make({ config: voiceActivityFor(60), gate: true })
    const out = run(processor, concat(tone(0.3, 0.3), tone(1, 0.001)))
    expect(out.subarray(Math.round(1.0 * RATE)).every((v) => Math.abs(v) < 1e-4)).toBe(true)
  })

  it('voz abaixo da sensibilidade não passa', () => {
    const processor = make({ config: voiceActivityFor(0), gate: true })
    const out = run(processor, tone(0.5, 0.05))
    expect(out.every((v) => v === 0)).toBe(true)
  })

  it('mudar a sensibilidade ao vivo vale na hora', () => {
    const processor = make({ config: voiceActivityFor(0), gate: true })
    const quiet = tone(0.5, 0.05)
    run(processor, quiet)
    processor.port.onmessage!({ data: { config: voiceActivityFor(100), gate: true } })
    const out = run(processor, quiet)
    expect(out.slice(Math.round(0.1 * RATE)).some((v) => Math.abs(v) > 0.01)).toBe(true)
  })
})

describe('voiceActivityWorklet — aviso de fala', () => {
  it('avisa quando a fala começa e quando termina, mesmo com o portão desligado', () => {
    const processor = make({ config: voiceActivityFor(60), gate: false })
    run(processor, concat(tone(0.2, 0.3), silence(0.6)))
    expect(processor.port.postMessage.mock.calls.map((c) => c[0])).toEqual([true, false])
  })
})
