import { describe, expect, it } from 'vitest'
import { DEFAULT_PROFILE_THEME } from '../../profile/lib/profileTheme'
import { borderTunable, effectOptions, levelLabel, withEffect } from './themeEditor'

describe('themeEditor', () => {
  it('trocar de efeito zera a cor escolhida', () => {
    const t = withEffect({ ...DEFAULT_PROFILE_THEME, effect_color: '#123456' }, 'fire')
    expect(t.effect).toBe('fire')
    expect(t.effect_color).toBe('')
  })
  it('opções do efeito', () => {
    expect(effectOptions(DEFAULT_PROFILE_THEME)).toEqual({ tunable: false, color: null })
    expect(effectOptions({ ...DEFAULT_PROFILE_THEME, effect: 'fire' })).toEqual({
      tunable: true,
      color: '#ff7a1a'
    })
    expect(
      effectOptions({ ...DEFAULT_PROFILE_THEME, effect: 'fire', effect_color: '#000000' }).color
    ).toBe('#000000')
    expect(effectOptions({ ...DEFAULT_PROFILE_THEME, effect: 'confetti' })).toEqual({
      tunable: true,
      color: null
    })
  })
  it('borda e níveis', () => {
    expect(borderTunable(DEFAULT_PROFILE_THEME)).toBe(false)
    expect(borderTunable({ ...DEFAULT_PROFILE_THEME, border: 'neon' })).toBe(true)
    expect(levelLabel(10)).toBe('Baixa')
    expect(levelLabel(50)).toBe('Média')
    expect(levelLabel(90)).toBe('Alta')
  })
})
