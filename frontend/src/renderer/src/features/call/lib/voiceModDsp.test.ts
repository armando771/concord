import { describe, expect, it } from 'vitest'
import { VOICE_MOD_LATENCY_MS, VoiceModDsp } from './voiceModDsp'

const RATE = 48_000
const BLOCK = 128

/** 1 s de sinal (375 blocos de 128 amostras). */
function signal(fn: (i: number) => number): Float32Array {
  return Float32Array.from({ length: RATE }, (_, i) => fn(i))
}

function sine(hz: number): Float32Array {
  return signal((i) => 0.5 * Math.sin((2 * Math.PI * hz * i) / RATE))
}

function run(dsp: VoiceModDsp, input: Float32Array): Float32Array {
  const out = new Float32Array(input.length)
  for (let i = 0; i < input.length; i += BLOCK) {
    dsp.process(input.subarray(i, i + BLOCK), out.subarray(i, i + BLOCK))
  }
  return out
}

/** Frequência estimada pelas passagens por zero, ignorando o primeiro quarto de segundo. */
function frequency(out: Float32Array): number {
  const from = Math.round(RATE * 0.25)
  let crossings = 0
  for (let i = from + 1; i < out.length; i++) if (out[i - 1] < 0 && out[i] >= 0) crossings++
  return crossings / ((out.length - from) / RATE)
}

describe('VoiceModDsp', () => {
  it('razão 1 devolve a entrada atrasada em 25 ms', () => {
    const delay = Math.round((RATE * VOICE_MOD_LATENCY_MS) / 1000)
    const input = sine(440)
    const out = run(new VoiceModDsp(RATE), input)
    for (let i = delay + 10; i < out.length; i += 97) {
      expect(out[i]).toBeCloseTo(input[i - delay], 4)
    }
  })

  it('razão 2 sobe uma oitava', () => {
    const dsp = new VoiceModDsp(RATE)
    dsp.ratio = 2
    expect(frequency(run(dsp, sine(1000)))).toBeCloseTo(2000, -2)
  })

  it('razão 0,5 desce uma oitava', () => {
    const dsp = new VoiceModDsp(RATE)
    dsp.ratio = 0.5
    expect(frequency(run(dsp, sine(1000)))).toBeCloseTo(500, -2)
  })

  it('a amplitude se mantém (as pontas somam 1)', () => {
    const dsp = new VoiceModDsp(RATE)
    dsp.ratio = 1.5
    const out = run(dsp, sine(1000))
    let peak = 0
    for (let i = RATE / 2; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]))
    expect(peak).toBeGreaterThan(0.45)
    expect(peak).toBeLessThan(0.55)
  })

  it('modulação em anel (profundidade 1) multiplica a voz por um seno', () => {
    const dsp = new VoiceModDsp(RATE)
    dsp.modHz = 100
    dsp.modDepth = 1
    expect(frequency(run(dsp, signal(() => 1)))).toBeCloseTo(100, -1)
  })

  it('profundidade parcial vira tremolo: o volume oscila sem inverter a voz', () => {
    const dsp = new VoiceModDsp(RATE)
    dsp.modHz = 5
    dsp.modDepth = 0.25
    const out = run(dsp, signal(() => 1)).subarray(RATE / 2)
    expect(Math.min(...out)).toBeCloseTo(0.5, 2)
    expect(Math.max(...out)).toBeCloseTo(1, 2)
  })

  it('vibrato oscila o tom em torno da razão base', () => {
    const dsp = new VoiceModDsp(RATE)
    dsp.vibratoHz = 4
    dsp.vibratoSemitones = 1
    const out = run(dsp, sine(1000))
    // Frequência em janelas de 25 ms ao longo de meio segundo (dois ciclos do vibrato).
    const window = RATE / 40
    const freqs: number[] = []
    for (let from = RATE / 4; from + window <= (RATE * 3) / 4; from += window) {
      freqs.push(frequency(out.subarray(from - RATE / 4, from + window)))
    }
    expect(Math.max(...freqs)).toBeGreaterThan(1030)
    expect(Math.min(...freqs)).toBeLessThan(970)
  })

  it('configure copia a mensagem da porta', () => {
    const dsp = new VoiceModDsp(RATE)
    dsp.configure({ ratio: 1.5, modHz: 7, modDepth: 0.3, vibratoHz: 6, vibratoSemitones: 0.8 })
    expect(dsp).toMatchObject({
      ratio: 1.5,
      modHz: 7,
      modDepth: 0.3,
      vibratoHz: 6,
      vibratoSemitones: 0.8
    })
  })

  it('sem entrada conta como silêncio', () => {
    const dsp = new VoiceModDsp(RATE)
    const out = new Float32Array(BLOCK)
    dsp.process(undefined, out)
    expect(out.every((v) => v === 0)).toBe(true)
  })
})
