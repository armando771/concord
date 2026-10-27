import { describe, expect, it } from 'vitest'
import type { Badge } from '../api/badges'
import { formatThreshold, publicStatText, remainingText, statText } from './badges'

/** Textos das unidades dos badges Amigos, Caçador de bugs e Top 10. */
function badge(over: Partial<Badge>): Badge {
  return {
    category: 'x',
    name: 'X',
    description: '',
    unit: 'friends',
    value: 0,
    tier: 0,
    progress: 0,
    obtainable: true,
    tiers: [],
    ...over
  }
}

const now = new Date('2026-10-25T12:00:00Z')

describe('Amigos', () => {
  const amigos = (over: Partial<Badge> = {}): Badge =>
    badge({ category: 'amigos', name: 'Amigos', unit: 'friends', ...over })

  it('conta, escada, quanto falta e visão pública', () => {
    expect(statText(amigos({ value: 1 }))).toBe('1 amigo')
    expect(statText(amigos({ value: 16 }))).toBe('16 amigos')
    expect(formatThreshold('friends', 100)).toBe('100 amigos')
    expect(remainingText(amigos({ value: 4, next_threshold: 5 }), now)).toBe('Falta 1 amigo')
    expect(remainingText(amigos({ value: 5, next_threshold: 15 }), now)).toBe('Faltam 10 amigos')
    const pub = amigos({
      value: undefined,
      tier: 1,
      tiers: [{ tier: 1, name: 'Enturmado', threshold: 5, rarity: 'comum' }]
    })
    expect(publicStatText(pub)).toBe('5+ amigos')
  })
})
