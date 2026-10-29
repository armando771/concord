import { DARK_INK, LIGHT_INK, contrastRatio, pickInk, relativeLuminance } from './profileInk'

describe('contraste', () => {
  it('luminância e razão batem com a WCAG', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1)
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1)
  })
  it('fundo escuro ou saturado escuro → texto claro', () => {
    expect(pickInk(['#111214'])).toBe('light')
    expect(pickInk(['#1e1b4b', '#0b1020'])).toBe('light')
    expect(pickInk(['#6b1d12', '#4b4f58'])).toBe('light')
    expect(pickInk(['#5865f2'])).toBe('light')
  })
  it('fundo claro → texto escuro', () => {
    expect(pickInk(['#ffffff'])).toBe('dark')
    expect(pickInk(['#fce7f3', '#f9a8d4'])).toBe('dark')
    expect(pickInk(['#fde047'])).toBe('dark')
    expect(pickInk(['#22d3ee'])).toBe('dark')
  })
  it('no degradê vale o pior ponto', () => {
    // Do branco ao preto nenhum texto vai bem nas duas pontas: fica o que
    // perde menos no pior ponto (pontas e meio).
    const points = ['#ffffff', '#000000', '#808080']
    const worst = (c: string): number => Math.min(...points.map((p) => contrastRatio(c, p)))
    const ink = pickInk(['#ffffff', '#000000'])
    const [chosen, other] = ink === 'dark' ? [DARK_INK, LIGHT_INK] : [LIGHT_INK, DARK_INK]
    expect(worst(chosen)).toBeGreaterThanOrEqual(worst(other))
    // Claro em cima, médio embaixo: o escuro ainda ganha.
    expect(pickInk(['#e0f2fe', '#7dd3fc'])).toBe('dark')
  })
  it('sempre escolhe o de maior contraste mínimo (varredura)', () => {
    for (let v = 0; v <= 255; v += 5) {
      const hex = `#${v.toString(16).padStart(2, '0').repeat(3)}`
      const ink = pickInk([hex])
      const chosen = contrastRatio(ink === 'dark' ? DARK_INK : LIGHT_INK, hex)
      const other = contrastRatio(ink === 'dark' ? LIGHT_INK : DARK_INK, hex)
      expect(chosen).toBeGreaterThanOrEqual(other)
      // Com uma cor só, o melhor dos dois textos nunca fica abaixo de 4:1.
      expect(chosen).toBeGreaterThanOrEqual(4)
    }
  })
  it('cor inválida é ignorada', () => {
    expect(pickInk(['nope'])).toBe('light')
  })
})
