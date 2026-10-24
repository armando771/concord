import { describe, expect, it } from 'vitest'
import { PcmRing } from './pcmRing'

const interleaved = (...pairs: Array<[number, number]>): Float32Array =>
  Float32Array.from(pairs.flat())

describe('PcmRing', () => {
  it('desintercala o estéreo na ordem em que chegou', () => {
    const ring = new PcmRing(16, 16)
    ring.push(interleaved([0.1, -0.1], [0.2, -0.2], [0.3, -0.3]))
    const left = new Float32Array(3)
    const right = new Float32Array(3)
    ring.pull(left, right)
    expect([...left].map((v) => +v.toFixed(1))).toEqual([0.1, 0.2, 0.3])
    expect([...right].map((v) => +v.toFixed(1))).toEqual([-0.1, -0.2, -0.3])
  })

  it('sem dados suficientes completa com silêncio (sem estalo de lixo)', () => {
    const ring = new PcmRing(16, 16)
    ring.push(interleaved([0.5, 0.5]))
    const left = new Float32Array(3)
    const right = new Float32Array(3)
    ring.pull(left, right)
    expect([...left]).toEqual([0.5, 0, 0])
  })

  it('acumulou atraso demais: descarta o mais antigo para voltar ao tempo real', () => {
    const ring = new PcmRing(16, 4) // no máximo 4 quadros de atraso
    ring.push(interleaved([1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6]))
    const left = new Float32Array(4)
    ring.pull(left, new Float32Array(4))
    expect([...left]).toEqual([3, 4, 5, 6])
  })
})
