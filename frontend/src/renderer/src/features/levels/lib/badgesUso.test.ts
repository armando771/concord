import { describe, expect, it } from 'vitest'
import type { Badge } from '../api/badges'
import { formatThreshold, publicStatText, remainingText, statText } from './badges'

// Textos dos badges de uso do app (DJ, Barulhento, Figurinha, Sequência,
// Câmera ligada, Votante, Aniversariante, Primeira mensagem).

function badge(over: Partial<Badge>): Badge {
  return {
    category: 'x',
    name: 'X',
    description: '',
    unit: 'messages',
    value: 0,
    tier: 0,
    progress: 0,
    obtainable: true,
    tiers: [],
    ...over
  }
}

describe('DJ (músicas na fila do Maestro)', () => {
  const dj = (over: Partial<Badge>): Badge =>
    badge({
      category: 'dj',
      name: 'DJ',
      unit: 'songs',
      tiers: [{ tier: 1, name: 'Pede Música', threshold: 10, rarity: 'comum' }],
      ...over
    })

  it('estatística, escada e quanto falta', () => {
    expect(statText(dj({ value: 1 }))).toBe('1 música pedida')
    expect(statText(dj({ value: 1234 }))).toBe('1.234 músicas pedidas')
    expect(formatThreshold('songs', 10)).toBe('10 músicas')
    expect(remainingText(dj({ value: 9, next_threshold: 10 }))).toBe('Falta 1 música')
    expect(publicStatText(dj({ tier: 1 }))).toBe('10+ músicas')
  })
})
