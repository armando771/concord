import { describe, expect, it } from 'vitest'
import { CURVE_SAMPLES, driveCurve, reverbImpulse, softLimitCurve } from './voiceModCurves'

/** Valor da curva de um WaveShaper para a entrada `x` (−1…1). */
function at(curve: Float32Array, x: number): number {
  return curve[Math.round(((x + 1) / 2) * (curve.length - 1))]
}

function energy(samples: Float32Array, from = 0, to = samples.length): number {
  let sum = 0
  for (let i = from; i < to; i++) sum += samples[i] * samples[i]
  return sum
}

describe('driveCurve (saturação)', () => {
  it('drive 0 é sem curva (o WaveShaper passa o sinal direto)', () => {
    expect(driveCurve(0)).toBeNull()
  })

  it('vai de −1 a 1, passa pelo zero e é simétrica', () => {
    const curve = driveCurve(3)!
    expect(curve).toHaveLength(CURVE_SAMPLES)
    expect(curve[0]).toBeCloseTo(-1, 5)
    expect(curve.at(-1)).toBeCloseTo(1, 5)
    expect(at(curve, 0)).toBeCloseTo(0, 5)
    expect(at(curve, 0.5)).toBeCloseTo(-at(curve, -0.5), 5)
  })

  it('mais drive satura mais (sinal médio sai mais alto)', () => {
    expect(at(driveCurve(4)!, 0.25)).toBeGreaterThan(at(driveCurve(1.5)!, 0.25))
    expect(at(driveCurve(1.5)!, 0.25)).toBeGreaterThan(0.25)
  })

  it('reaproveita a mesma curva para o mesmo drive', () => {
    expect(driveCurve(2.5)).toBe(driveCurve(2.5))
  })
})

describe('softLimitCurve (limitador do fim do caminho processado)', () => {
  const HEADROOM = 2
  const curve = softLimitCurve(0.8, HEADROOM)

  it('abaixo do limiar não mexe no sinal (descontado o headroom)', () => {
    // A entrada chega dividida pelo headroom: x na curva = sinal / headroom.
    expect(at(curve, 0)).toBeCloseTo(0, 5)
    expect(at(curve, 0.5 / HEADROOM)).toBeCloseTo(0.5, 2)
    expect(at(curve, -0.7 / HEADROOM)).toBeCloseTo(-0.7, 2)
  })

  it('nunca passa de 1, nem com o sinal no dobro do fundo de escala', () => {
    for (const v of curve) expect(Math.abs(v)).toBeLessThan(1)
    expect(curve.at(-1)).toBeGreaterThan(0.95)
  })

  it('é crescente (não inverte picos)', () => {
    for (let i = 1; i < curve.length; i++) expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1])
  })
})

describe('reverbImpulse (resposta de uma caverna sintetizada)', () => {
  const RATE = 48_000
  const opts = { seconds: 2, preDelaySeconds: 0.02 }

  it('tem a duração pedida e começa em silêncio (pré-atraso)', () => {
    const ir = reverbImpulse(RATE, opts)
    expect(ir).toHaveLength(RATE * 2)
    expect(energy(ir, 0, Math.round(RATE * 0.02))).toBe(0)
  })

  it('tem energia 1: o nível do reverb é o nível do envio', () => {
    expect(energy(reverbImpulse(RATE, opts))).toBeCloseTo(1, 3)
  })

  it('decai: o último quarto quase não tem energia', () => {
    const ir = reverbImpulse(RATE, opts)
    const quarter = ir.length / 4
    expect(energy(ir, ir.length - quarter)).toBeLessThan(energy(ir, 0, quarter) / 100)
  })

  it('é determinístico pela semente', () => {
    expect(reverbImpulse(RATE, opts, 7)).toEqual(reverbImpulse(RATE, opts, 7))
    expect(reverbImpulse(RATE, opts, 7)).not.toEqual(reverbImpulse(RATE, opts, 8))
  })
})
