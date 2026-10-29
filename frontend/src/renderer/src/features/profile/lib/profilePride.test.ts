import { describe, expect, it } from 'vitest'
import { contrastRatio } from './profileInk'
import { PRIDE_PALETTE, PRIDE_STRIPES, prideGradient } from './profilePride'

describe('fundo pride', () => {
  it('tem as seis faixas da bandeira', () => {
    expect(PRIDE_STRIPES).toEqual([
      '#e40303',
      '#ff8c00',
      '#ffed00',
      '#008026',
      '#24408e',
      '#732982'
    ])
    expect(PRIDE_PALETTE).toHaveLength(6)
  })
  it('o texto branco passa no contraste AA em todas as faixas', () => {
    for (const c of PRIDE_PALETTE) expect(contrastRatio('#ffffff', c), c).toBeGreaterThanOrEqual(4.5)
  })
  it('degradê de faixas duras no ângulo pedido', () => {
    const g = prideGradient(180)
    expect(g.startsWith('linear-gradient(180deg, ')).toBe(true)
    expect(g).toContain(`${PRIDE_PALETTE[0]} 0% 16.67%`)
    expect(g).toContain(`${PRIDE_PALETTE[5]} 83.33% 100%`)
    expect(prideGradient(90)).toContain('linear-gradient(90deg')
  })
})
