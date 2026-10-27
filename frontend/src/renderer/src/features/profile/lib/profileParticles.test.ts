import { describe, expect, it } from 'vitest'
import { effectParticles } from './profileParticles'

describe('effectParticles', () => {
  it('determinístico e dentro do cartão', () => {
    for (const e of ['particles', 'sparkles', 'snow']) {
      const a = effectParticles(e)
      expect(a.length).toBeGreaterThan(0)
      expect(effectParticles(e)).toEqual(a)
      for (const p of a) {
        expect(p.left).toBeGreaterThanOrEqual(0)
        expect(p.left).toBeLessThanOrEqual(100)
        expect(p.top).toBeGreaterThanOrEqual(0)
        expect(p.top).toBeLessThanOrEqual(100)
      }
    }
    expect(effectParticles('none')).toEqual([])
  })
})
