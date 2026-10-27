import { describe, expect, it } from 'vitest'
import type { Badge } from '../api/badges'
import { formatThreshold, publicStatText, remainingText, statText } from './badges'

/** Textos das unidades de badge contadas em itens (propostas, amigos...). */
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

describe('Contribuinte (cards de propostas)', () => {
  const contribuinte = (over: Partial<Badge> = {}): Badge =>
    badge({ category: 'contribuinte', name: 'Contribuinte', unit: 'proposals', ...over })

  it('conta as propostas criadas', () => {
    expect(statText(contribuinte({ value: 1 }))).toBe('1 proposta criada')
    expect(statText(contribuinte({ value: 0 }))).toBe('0 propostas criadas')
    expect(statText(contribuinte({ value: 1234 }))).toBe('1.234 propostas criadas')
  })

  it('escada, quanto falta e visão pública', () => {
    expect(formatThreshold('proposals', 1)).toBe('1 proposta')
    expect(formatThreshold('proposals', 15)).toBe('15 propostas')
    expect(remainingText(contribuinte({ value: 4, next_threshold: 5 }), now)).toBe(
      'Falta 1 proposta'
    )
    expect(remainingText(contribuinte({ value: 5, next_threshold: 15 }), now)).toBe(
      'Faltam 10 propostas'
    )
    const pub = contribuinte({
      value: undefined,
      tier: 2,
      tiers: [
        { tier: 1, name: 'Ideia', threshold: 1, rarity: 'comum' },
        { tier: 2, name: 'Colaborador', threshold: 5, rarity: 'raro' }
      ]
    })
    expect(publicStatText(pub)).toBe('5+ propostas')
  })
})

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
