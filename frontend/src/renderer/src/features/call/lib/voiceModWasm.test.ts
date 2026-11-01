import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { VoiceModDsp, type VoiceModWorkletMessage } from './voiceModDsp'
import { PRESET_ORDER, VOICE_MOD_PRESETS, voiceModParams } from './voiceModPresets'
import { VoiceModWasm } from './voiceModWasm'

// O voice mod em Rust/WASM tem de soar igual ao JS: mesmos sinais, mesma saída
// (a menos de arredondamento de f32), em todo preset.

const RATE = 48_000
const BLOCK = 128
const TOLERANCE = 1e-5

const dspModule = new WebAssembly.Module(
  readFileSync(new URL('./concordDsp.wasm', import.meta.url))
)

/** "Voz" sintética: harmônicos de 140 Hz, sílabas a 4 Hz e um pouco de ruído. */
function speechLike(seconds: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * RATE))
  let seed = 7
  for (let i = 0; i < out.length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0
    const t = i / RATE
    let v = 0
    for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * 140 * h * t) / h
    out[i] = 0.15 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * t)) * v + 0.02 * (seed / 2 ** 32 - 0.5)
  }
  return out
}

interface Processor {
  configure: (message: VoiceModWorkletMessage) => void
  process: (input: Float32Array | undefined, output: Float32Array) => void
}

function run(dsp: Processor, input: Float32Array, block = BLOCK): Float32Array {
  const out = new Float32Array(input.length)
  for (let i = 0; i < input.length; i += block) {
    dsp.process(input.subarray(i, i + block), out.subarray(i, i + block))
  }
  return out
}

function maxDiff(a: Float32Array, b: Float32Array): number {
  let max = 0
  for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i]))
  return max
}

function pair(message: VoiceModWorkletMessage): [Processor, Processor] {
  const js = new VoiceModDsp(RATE)
  const wasm = VoiceModWasm.create(RATE, dspModule)!
  js.configure(message)
  wasm.configure(message)
  return [js, wasm]
}

function presetMessage(preset: (typeof PRESET_ORDER)[number]): VoiceModWorkletMessage {
  const p = voiceModParams({ preset, customized: false, ...VOICE_MOD_PRESETS[preset].values })
  return {
    ratio: p.pitchRatio,
    modHz: p.modHz,
    modDepth: p.modDepth,
    vibratoHz: p.vibratoHz,
    vibratoSemitones: p.vibratoSemitones
  }
}

describe('VoiceModWasm × VoiceModDsp (JS)', () => {
  const input = speechLike(2)

  it.each(PRESET_ORDER)('preset %s: mesma saída', (preset) => {
    const [js, wasm] = pair(presetMessage(preset))
    const expected = run(js, input)
    expect(expected.some((v) => Math.abs(v) > 0.05)).toBe(true)
    expect(maxDiff(run(wasm, input), expected)).toBeLessThan(TOLERANCE)
  })

  it.each([-12, -7, 3, 12])('tom de %i semitons: mesma saída', (pitch) => {
    const [js, wasm] = pair({
      ratio: 2 ** (pitch / 12),
      modHz: 0,
      modDepth: 0,
      vibratoHz: 0,
      vibratoSemitones: 0
    })
    expect(maxDiff(run(wasm, input), run(js, input))).toBeLessThan(TOLERANCE)
  })

  it('trocar de preset no meio do áudio: mesma saída', () => {
    const [js, wasm] = pair(presetMessage('alien'))
    const half = input.length / 2
    const first = maxDiff(run(wasm, input.subarray(0, half)), run(js, input.subarray(0, half)))
    js.configure(presetMessage('robo'))
    wasm.configure(presetMessage('robo'))
    const second = maxDiff(run(wasm, input.subarray(half)), run(js, input.subarray(half)))
    expect(Math.max(first, second)).toBeLessThan(TOLERANCE)
  })

  it('sem entrada (track parada) é silêncio nos dois', () => {
    const [js, wasm] = pair(presetMessage('esquilo'))
    run(js, input)
    run(wasm, input)
    const a = new Float32Array(BLOCK)
    const b = new Float32Array(BLOCK)
    js.process(undefined, a)
    wasm.process(undefined, b)
    expect(maxDiff(a, b)).toBeLessThan(TOLERANCE)
  })

  it('bloco maior que o buffer do WASM é processado em pedaços', () => {
    const [js, wasm] = pair(presetMessage('grave'))
    expect(maxDiff(run(wasm, input, 2048), run(js, input, 2048))).toBeLessThan(TOLERANCE)
  })

  it('entrada mais curta que a saída completa com silêncio, como no JS', () => {
    const [js, wasm] = pair(presetMessage('normal'))
    const a = new Float32Array(BLOCK)
    const b = new Float32Array(BLOCK)
    for (let i = 0; i < 400; i++) {
      js.process(input.subarray(0, 64), a)
      wasm.process(input.subarray(0, 64), b)
    }
    expect(maxDiff(a, b)).toBeLessThan(TOLERANCE)
  })
})

describe('VoiceModWasm.create', () => {
  it('sem módulo, ou com algo que não é módulo, devolve null (o worklet usa o JS)', () => {
    expect(VoiceModWasm.create(RATE, null)).toBeNull()
    expect(VoiceModWasm.create(RATE, new ArrayBuffer(8))).toBeNull()
  })

  it('taxa que não cabe no buffer devolve null', () => {
    expect(VoiceModWasm.create(1_000_000, dspModule)).toBeNull()
  })

  it('módulo que não instancia devolve null', () => {
    // Um módulo válido que importa algo que ninguém fornece.
    const needsImport = new WebAssembly.Module(
      new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 2, 7, 1, 1, 109, 1, 102, 0, 0
      ])
    )
    expect(VoiceModWasm.create(RATE, needsImport)).toBeNull()
  })
})
