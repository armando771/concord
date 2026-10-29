import { colors } from '../../../shared/theme/tokens'
import { cardLook } from './cardLook'
import { DARK_INK, LIGHT_INK } from './profileInk'
import { PRIDE_PALETTE, PRIDE_STRIPES } from './profilePride'

describe('cardLook', () => {
  it('sem tema: sem borda, fundo e texto do app', () => {
    for (const theme of [null, undefined, {}]) {
      expect(cardLook(theme)).toMatchObject({
        borderWidth: 0,
        backgroundColor: colors.bgFloating,
        ink: 'light',
        textColor: colors.textStrong,
        mutedColor: colors.textMuted
      })
    }
  })

  it('fundo de cor sólida usa a cor', () => {
    const look = cardLook({ background: 'solid', background_colors: ['#112233'] })
    expect(look.backgroundColor).toBe('#112233')
  })

  it('degradê cai na primeira cor (o desenho de verdade vem com o Skia)', () => {
    const look = cardLook({ background: 'gradient', background_colors: ['#1e1b4b', '#0b1020'] })
    expect(look.backgroundColor).toBe('#1e1b4b')
    expect(look.ink).toBe('light')
  })

  it('fundo claro troca o texto para o escuro', () => {
    const look = cardLook({ background: 'solid', background_colors: ['#fce7f3'] })
    expect(look.ink).toBe('dark')
    expect(look.textColor).toBe(DARK_INK)
    expect(look.mutedColor).not.toBe(colors.textMuted)
  })

  it('fundo escuro mantém o texto claro', () => {
    const look = cardLook({ background: 'solid', background_colors: ['#1e1b4b'] })
    expect(look.ink).toBe('light')
    expect(look.textColor).toBe(LIGHT_INK)
  })

  it('pride usa a primeira faixa e texto claro', () => {
    const look = cardLook({ background: 'pride' })
    expect(look.backgroundColor).toBe(PRIDE_PALETTE[0])
    expect(look.ink).toBe('light')
  })

  it('borda: cor e espessura do tema', () => {
    const look = cardLook({ border: 'neon', border_colors: ['#00ffaa'], border_width: 4 })
    expect(look).toMatchObject({ borderWidth: 4, borderColor: '#00ffaa' })
  })

  it('borda sem espessura escolhida usa a padrão do tema', () => {
    expect(cardLook({ border: 'solid', border_colors: ['#ec4899'] }).borderWidth).toBe(2)
  })

  it('borda em degradê usa a primeira cor; arco-íris, a primeira faixa da bandeira', () => {
    expect(cardLook({ border: 'gradient', border_colors: ['#111111', '#222222'] }).borderColor).toBe('#111111')
    expect(cardLook({ border: 'rainbow' }).borderColor).toBe(PRIDE_STRIPES[0])
  })

  it('dado inválido do servidor volta ao padrão sem lançar erro', () => {
    const look = cardLook({ border: 'x', border_colors: ['vermelho'], background: 'solid', background_colors: ['#fff'] })
    expect(look).toMatchObject({ borderWidth: 0, backgroundColor: colors.bgFloating, ink: 'light' })
  })
})
