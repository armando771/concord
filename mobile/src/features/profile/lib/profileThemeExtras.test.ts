import {
  DEFAULT_EXTRAS,
  GRADIENT_DIRECTIONS,
  MAX_BORDER_WIDTH,
  resolveExtras
} from './profileThemeExtras'

describe('resolveExtras', () => {
  it('ausente (tema antigo) vira o padrão', () => {
    expect(resolveExtras(undefined)).toEqual(DEFAULT_EXTRAS)
    expect(resolveExtras(null)).toEqual(DEFAULT_EXTRAS)
    expect(resolveExtras({})).toEqual(DEFAULT_EXTRAS)
  })
  it('zeros do backend antigo viram o padrão', () => {
    expect(
      resolveExtras({ effect_density: 0, effect_speed: 0, border_width: 0, background_angle: 0 })
    ).toEqual(DEFAULT_EXTRAS)
  })
  it('mantém valores válidos (cor em minúsculas)', () => {
    const v = {
      effect_color: '#AABBCC',
      effect_density: 1,
      effect_speed: 100,
      border_animation: 'spin',
      border_width: MAX_BORDER_WIDTH,
      background_angle: 360,
      texture: 'grid'
    }
    expect(resolveExtras(v)).toEqual({ ...v, effect_color: '#aabbcc' })
  })
  it('cada valor inválido volta ao padrão sozinho', () => {
    const t = resolveExtras({
      effect_color: 'red;x',
      effect_density: 101,
      effect_speed: 2.5,
      border_animation: 'wobble',
      border_width: 7,
      background_angle: -1,
      texture: 'grain'
    })
    expect(t).toEqual({ ...DEFAULT_EXTRAS, texture: 'grain' })
  })
})


describe('direções do degradê', () => {
  it('as direções do degradê são ângulos válidos e incluem o padrão', () => {
    for (const d of GRADIENT_DIRECTIONS) {
      expect(resolveExtras({ background_angle: d.angle }).background_angle).toBe(d.angle)
    }
    expect(GRADIENT_DIRECTIONS.some((d) => d.angle === DEFAULT_EXTRAS.background_angle)).toBe(true)
    // Sem seta de texto: o editor gira um ícone pelo ângulo.
    for (const d of GRADIENT_DIRECTIONS) expect(Object.keys(d).sort()).toEqual(['angle', 'label'])
  })
})