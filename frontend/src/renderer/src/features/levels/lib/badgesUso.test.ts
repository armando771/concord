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

describe('Barulhento (sons da mesa de áudio)', () => {
  const b = (over: Partial<Badge>): Badge =>
    badge({
      category: 'barulhento',
      name: 'Barulhento',
      unit: 'sounds',
      tiers: [{ tier: 1, name: 'Buzina', threshold: 25, rarity: 'comum' }],
      ...over
    })

  it('estatística, escada e quanto falta', () => {
    expect(statText(b({ value: 1 }))).toBe('1 som tocado')
    expect(statText(b({ value: 30 }))).toBe('30 sons tocados')
    expect(formatThreshold('sounds', 25)).toBe('25 sons')
    expect(remainingText(b({ value: 20, next_threshold: 25 }))).toBe('Faltam 5 sons')
    expect(publicStatText(b({ tier: 1 }))).toBe('25+ sons')
  })
})

describe('Figurinha (figurinhas e GIFs)', () => {
  const b = (over: Partial<Badge>): Badge =>
    badge({
      category: 'figurinha',
      name: 'Figurinha',
      unit: 'stickers',
      tiers: [{ tier: 1, name: 'Figurinha Repetida', threshold: 10, rarity: 'comum' }],
      ...over
    })

  it('estatística, escada e quanto falta', () => {
    expect(statText(b({ value: 1 }))).toBe('1 figurinha ou GIF enviado')
    expect(statText(b({ value: 12 }))).toBe('12 figurinhas e GIFs enviados')
    expect(formatThreshold('stickers', 10)).toBe('10 figurinhas e GIFs')
    expect(remainingText(b({ value: 9, next_threshold: 10 }))).toBe('Falta 1 figurinha ou GIF')
    expect(publicStatText(b({ tier: 1 }))).toBe('10+ figurinhas e GIFs')
  })
})

describe('Sequência (dias seguidos usando o app)', () => {
  const b = (over: Partial<Badge>): Badge =>
    badge({
      category: 'sequencia',
      name: 'Sequência',
      unit: 'days',
      tiers: [{ tier: 1, name: 'Faísca', threshold: 3, rarity: 'comum' }],
      ...over
    })

  it('mostra o recorde, a escada e a próxima meta', () => {
    expect(statText(b({ value: 1 }))).toBe('Recorde de 1 dia seguido')
    expect(statText(b({ value: 12 }))).toBe('Recorde de 12 dias seguidos')
    expect(formatThreshold('days', 7)).toBe('7 dias seguidos')
    // O recorde não é a sequência atual: a meta é uma sequência, não "faltam N".
    expect(remainingText(b({ value: 2, next_threshold: 7 }))).toBe('Uma sequência de 7 dias')
    expect(publicStatText(b({ tier: 1 }))).toBe('3+ dias seguidos')
  })
})

describe('Câmera ligada (horas de câmera em call)', () => {
  const b = (over: Partial<Badge>): Badge =>
    badge({
      category: 'camera',
      name: 'Câmera ligada',
      unit: 'seconds',
      tiers: [{ tier: 1, name: 'Rostinho', threshold: 3600, rarity: 'comum' }],
      ...over
    })

  it('fala das horas com a câmera ligada', () => {
    expect(statText(b({ value: 2 * 3600 }))).toBe('2 horas com a câmera ligada')
    expect(publicStatText(b({ tier: 1 }))).toBe('1+ hora com a câmera ligada')
    expect(remainingText(b({ value: 1800, next_threshold: 3600 }))).toBe('Faltam 30 min')
  })
})

describe('Votante (votos no quadro de propostas)', () => {
  const b = (over: Partial<Badge>): Badge =>
    badge({
      category: 'votante',
      name: 'Votante',
      unit: 'votes',
      tiers: [{ tier: 1, name: 'Eleitor', threshold: 1, rarity: 'comum' }],
      ...over
    })

  it('estatística, escada e quanto falta', () => {
    expect(statText(b({ value: 1 }))).toBe('1 voto dado')
    expect(statText(b({ value: 42 }))).toBe('42 votos dados')
    expect(formatThreshold('votes', 10)).toBe('10 votos')
    expect(remainingText(b({ value: 0, next_threshold: 1 }))).toBe('Falta 1 voto')
    expect(publicStatText(b({ tier: 1 }))).toBe('1+ voto')
  })
})

describe('Aniversariante (ganho no dia do aniversário)', () => {
  const b = (over: Partial<Badge>): Badge =>
    badge({
      category: 'aniversariante',
      name: 'Aniversariante',
      unit: 'birthday',
      tiers: [{ tier: 1, name: 'Aniversariante', threshold: 1, rarity: 'comum' }],
      ...over
    })

  it('no dia, depois do dia e antes de ganhar', () => {
    expect(statText(b({ value: 1, tier: 1 }))).toBe('Hoje é o seu aniversário!')
    expect(statText(b({ value: 0, tier: 1 }))).toBe('Comemorou o aniversário no Salinha')
    expect(formatThreshold('birthday', 1)).toBe('No dia do aniversário')
    expect(remainingText(b({ next_threshold: 1 }))).toBe('Chega no dia do seu aniversário')
  })

  it('no perfil dos outros não mostra a data nem número', () => {
    expect(publicStatText(b({ tier: 1 }))).toBe('Comemorou o aniversário no Salinha')
  })
})

describe('Primeira mensagem (primeira mensagem de um servidor)', () => {
  const b = (over: Partial<Badge>): Badge =>
    badge({
      category: 'primeira',
      name: 'Primeira mensagem',
      unit: 'firsts',
      tiers: [
        { tier: 1, name: 'Quebra-gelo', threshold: 1, rarity: 'raro' },
        { tier: 2, name: 'Desbravador', threshold: 3, rarity: 'epico' }
      ],
      ...over
    })

  it('estatística, escada e quanto falta', () => {
    expect(statText(b({ value: 1 }))).toBe('Primeira mensagem de 1 servidor')
    expect(statText(b({ value: 4 }))).toBe('Primeira mensagem de 4 servidores')
    expect(formatThreshold('firsts', 3)).toBe('3 servidores')
    expect(remainingText(b({ value: 1, tier: 1, next_threshold: 3 }))).toBe('Faltam 2 servidores')
    expect(publicStatText(b({ tier: 2 }))).toBe('Primeira mensagem de 3+ servidores')
  })
})
