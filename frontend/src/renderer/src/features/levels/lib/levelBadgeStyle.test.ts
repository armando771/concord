import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../../../shared/lib/contrast'
import { levelTier } from './levels'
import { badgeShadow, levelBadgeStyle, PRIDE_COLORS, SPECIAL_BADGE_LEVELS } from './levelBadgeStyle'

describe('levelBadgeStyle', () => {
  it('13, 14, 22 e 24 têm selo especial; os outros seguem a faixa', () => {
    expect(levelBadgeStyle(13).variant).toBe('estrelas')
    expect(levelBadgeStyle(14).variant).toBe('onca')
    expect(levelBadgeStyle(22).variant).toBe('brasil')
    expect(levelBadgeStyle(24).variant).toBe('orgulho')
    for (const level of [1, 12, 15, 21, 23, 25, 34, 99]) {
      expect(levelBadgeStyle(level).variant, `nível ${level}`).toBe('faixa')
    }
    expect(levelBadgeStyle(100).variant).toBe('lendario')
    expect(levelBadgeStyle(250).variant).toBe('lendario')
    expect([...SPECIAL_BADGE_LEVELS]).toEqual([13, 14, 22, 24])
  })

  it('o selo comum continua igual: degradê da faixa e texto escuro', () => {
    const look = levelBadgeStyle(42)
    const tier = levelTier(42)
    expect(look.style.backgroundImage).toBe(
      `linear-gradient(135deg, ${tier.color}, ${tier.accent})`
    )
    expect(look.text).toBe('#0b0b0f')
    expect(look.glow).toBe(tier.color)
  })

  it('o lendário mantém o arco-íris animado', () => {
    expect(levelBadgeStyle(120).className).toContain('level-legendary')
  })

  it('nos selos especiais o texto passa no AA (4,5:1) contra tudo que fica atrás dele', () => {
    for (const level of SPECIAL_BADGE_LEVELS) {
      const look = levelBadgeStyle(level)
      expect(look.surface.length, `nível ${level}`).toBeGreaterThan(0)
      for (const bg of look.surface) {
        expect(contrastRatio(look.text, bg), `nível ${level} sobre ${bg}`).toBeGreaterThanOrEqual(
          4.5
        )
      }
    }
  })

  it('cada especial tem o fundo e a classe dele', () => {
    expect(levelBadgeStyle(13).className).toContain('level-badge-estrelas')
    expect(levelBadgeStyle(13).style.backgroundImage).toContain('radial-gradient')
    expect(levelBadgeStyle(14).style.backgroundImage).toContain('svg')
    expect(levelBadgeStyle(22).style.backgroundImage).toContain('#006b33')
    expect(levelBadgeStyle(22).text).toBe('#ffdf00')
    const pride = levelBadgeStyle(24).style.backgroundImage ?? ''
    for (const color of PRIDE_COLORS) expect(pride).toContain(color)
    expect(levelBadgeStyle(24).className).toContain('level-badge-orgulho')
  })

  it('nível fora do normal não quebra (0, negativo, NaN)', () => {
    expect(levelBadgeStyle(0).variant).toBe('faixa')
    expect(levelBadgeStyle(-3).variant).toBe('faixa')
    expect(levelBadgeStyle(Number.NaN).variant).toBe('faixa')
  })

  it('badgeShadow soma o brilho da subida ao friso do selo', () => {
    expect(badgeShadow(levelBadgeStyle(42), false)).toBeUndefined()
    expect(badgeShadow(levelBadgeStyle(42), true)).toBe(`0 0 14px ${levelTier(42).color}`)
    expect(badgeShadow(levelBadgeStyle(22), true)).toBe(
      'inset 0 0 0 1px #ffdf00aa, 0 0 14px #ffdf00'
    )
    // O lendário brilha sempre, igual subindo ou não.
    const legendary = levelBadgeStyle(120)
    expect(badgeShadow(legendary, true)).toBe(badgeShadow(legendary, false))
    expect(badgeShadow(legendary, false)).toContain('0 0 10px')
  })
})
