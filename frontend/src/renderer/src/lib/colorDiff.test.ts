import { describe, expect, it } from 'vitest'
import { colorDistance, deltaE2000Lab } from './colorDiff'

describe('colorDistance (ΔE2000)', () => {
  it('cor igual dá zero, e a ordem não importa', () => {
    expect(colorDistance('#1a1a1e', '#1a1a1e')).toBe(0)
    expect(colorDistance('#121214', '#393a41')).toBeCloseTo(colorDistance('#393a41', '#121214'), 10)
  })

  it('bate com os pares de teste publicados por Sharma, Wu e Dalal (2005)', () => {
    expect(deltaE2000Lab([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 3)
    expect(deltaE2000Lab([50, 2.5, 0], [73, 25, -18])).toBeCloseTo(27.1492, 3)
    expect(deltaE2000Lab([50, 2.5, 0], [50, 3.1736, 0.5854])).toBeCloseTo(1.0, 3)
  })

  it('preto e branco ficam a 100', () => {
    expect(colorDistance('#000000', '#ffffff')).toBeCloseTo(100, 0)
  })

  it('o cinza antigo do tema é bem mais claro que o do Discord', () => {
    expect(colorDistance('#393a41', '#1a1a1e')).toBeGreaterThan(8)
  })

  it('cor translúcida é composta sobre a base', () => {
    expect(colorDistance('rgba(151, 151, 159, 0.122)', '#222225', '#121214')).toBeLessThan(1)
  })

  it('cor ilegível é erro', () => {
    expect(() => colorDistance('var(--x)', '#000')).toThrow()
  })
})
