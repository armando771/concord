import { contrastRatio } from './profileInk'
import { PRIDE_PALETTE, PRIDE_STRIPES } from './profilePride'

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
    for (const c of PRIDE_PALETTE) expect(contrastRatio('#ffffff', c)).toBeGreaterThanOrEqual(4.5)
  })
})
