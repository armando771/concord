import { contrastRatio } from '../../../shared/lib/contrast'
import { readableColor } from './readableColor'

const PINK = ['#f9c9e0', '#f6a9cd']
const NAVY = ['#14142b']

describe('readableColor', () => {
  it('não mexe em cor que já tem contraste', () => {
    expect(readableColor('#99aab5', NAVY, 'light')).toBe('#99aab5')
    expect(readableColor('#ed4245', NAVY, 'light')).toBe('#ed4245')
    expect(readableColor('#c9d1dc', NAVY, 'light')).toBe('#c9d1dc')
  })

  it('sem fundo próprio devolve a cor do jeito que veio', () => {
    expect(readableColor('#c9d1dc', [], 'light')).toBe('#c9d1dc')
  })

  it('escurece cinza e prata sobre fundo rosa até dar contraste', () => {
    for (const cor of ['#99aab5', '#c9d1dc', '#ed4245']) {
      const out = readableColor(cor, PINK, 'dark')
      expect(out).not.toBe(cor)
      // Fundo real dos blocos: o rosa com o branco translúcido do cartão.
      expect(contrastRatio(out, 'rgb(255 255 255 / 0.45)', PINK[1])).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('clareia sobre fundo escuro quando a cor some nele', () => {
    const out = readableColor('#1a1a2e', NAVY, 'light')
    expect(contrastRatio(out, NAVY[0])).toBeGreaterThanOrEqual(4.5)
  })

  it('cor inválida volta como veio, sem lançar', () => {
    expect(readableColor('var(--x)', PINK, 'dark')).toBe('var(--x)')
    expect(readableColor('#c9d1dc', ['var(--bg)'], 'dark')).toBe('#c9d1dc')
  })
})
