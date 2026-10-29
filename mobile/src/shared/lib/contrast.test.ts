import { composite, contrastRatio, parseColor, relativeLuminance } from './contrast'

describe('parseColor', () => {
  it('lê hex curto, longo e com alfa', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseColor('#5865F2')).toEqual({ r: 88, g: 101, b: 242, a: 1 })
    expect(parseColor('#00000080')).toEqual({ r: 0, g: 0, b: 0, a: 128 / 255 })
  })

  it('lê rgb() e rgba() com vírgula ou espaço', () => {
    expect(parseColor('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3, a: 1 })
    expect(parseColor('rgba(151, 151, 159, 0.2)')).toEqual({ r: 151, g: 151, b: 159, a: 0.2 })
    expect(parseColor('rgb(10 20 30 / 50%)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 })
  })

  it('o que não é cor vira null', () => {
    expect(parseColor('var(--x)')).toBeNull()
    expect(parseColor('#12')).toBeNull()
    expect(parseColor('red')).toBeNull()
  })
})

describe('contraste (WCAG 2)', () => {
  it('luminância relativa dos extremos', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0, a: 1 })).toBe(0)
    expect(relativeLuminance({ r: 255, g: 255, b: 255, a: 1 })).toBe(1)
  })

  it('preto no branco é 21:1 e a ordem não importa', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5)
    expect(contrastRatio('#777', '#777')).toBeCloseTo(1, 5)
  })

  it('bate com valores conhecidos', () => {
    // Branco no blurple do Discord: ~4.6:1 (passa AA por pouco).
    expect(contrastRatio('#ffffff', '#5865f2')).toBeCloseTo(4.61, 1)
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 1)
  })

  it('cor translúcida é composta sobre o fundo antes de medir', () => {
    expect(composite(parseColor('rgba(255, 255, 255, 0.5)')!, parseColor('#000')!)).toEqual({
      r: 127.5,
      g: 127.5,
      b: 127.5,
      a: 1
    })
    // Texto 100% transparente some no fundo.
    expect(contrastRatio('rgba(255, 255, 255, 0)', '#000')).toBeCloseTo(1, 5)
  })

  it('fundo translúcido precisa de uma base', () => {
    expect(contrastRatio('#fff', 'rgba(0, 0, 0, 0.5)', '#ffffff')).toBeCloseTo(
      contrastRatio('#fff', '#808080'),
      1
    )
  })

  it('cor inválida dá erro claro', () => {
    expect(() => contrastRatio('nada', '#fff')).toThrow(/nada/)
  })
})
