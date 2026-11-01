import { describe, expect, it } from 'vitest'
import { badgeText, railBadgeCount, voiceBadgeLabel } from './serverRailBadge'

describe('railBadgeCount', () => {
  it('menções têm prioridade sobre não lidas', () => {
    expect(railBadgeCount(2, 9)).toBe(2)
    expect(railBadgeCount(0, 9)).toBe(9)
    expect(railBadgeCount(0, 0)).toBe(0)
  })
})

describe('badgeText', () => {
  it('passa de 99 vira 99+', () => {
    expect(badgeText(7)).toBe('7')
    expect(badgeText(99)).toBe('99')
    expect(badgeText(100)).toBe('99+')
  })
})

describe('voiceBadgeLabel', () => {
  it('diferencia quando eu estou na call de quando só há gente nela', () => {
    expect(voiceBadgeLabel(true)).toBe('Em chamada')
    expect(voiceBadgeLabel(false)).toBe('Chamada em andamento')
  })
})
