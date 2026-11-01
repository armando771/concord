import { nameColorOf } from './cardName'

describe('nameColorOf', () => {
  const FALLBACK = '#ffffff'

  it('sem estilo ou estilo padrão: a cor do texto do cartão', () => {
    expect(nameColorOf(undefined, FALLBACK)).toBe(FALLBACK)
    expect(nameColorOf(null, FALLBACK)).toBe(FALLBACK)
    expect(nameColorOf({ font: 'default', effect: 'solid', colors: [] }, FALLBACK)).toBe(FALLBACK)
  })

  it('cor sólida escolhida', () => {
    expect(nameColorOf({ font: 'tempo', effect: 'solid', colors: ['#00FFAA'] }, FALLBACK)).toBe('#00ffaa')
  })

  it('efeito com duas cores usa a primeira até o Skia desenhar o efeito de verdade', () => {
    expect(nameColorOf({ font: 'default', effect: 'gradient', colors: ['#111111', '#222222'] }, FALLBACK)).toBe('#111111')
  })

  it('efeito sem cor própria (arco-íris, fogo) usa a cor do texto', () => {
    expect(nameColorOf({ font: 'default', effect: 'rainbow', colors: [] }, FALLBACK)).toBe(FALLBACK)
  })

  it('dado inválido do servidor não lança erro e cai na cor do texto', () => {
    expect(nameColorOf({ font: 'x', effect: 'y', colors: ['vermelho'] }, FALLBACK)).toBe(FALLBACK)
  })
})
