import { describe, expect, it } from 'vitest'
import { boostLabel, boostRank } from './boost'

describe('boostRank', () => {
  it('sem buff abaixo de 125%', () => {
    expect(boostRank(100)).toBeNull()
    expect(boostRank(124)).toBeNull()
    expect(boostRank(0)).toBeNull()
  })

  it('mapeia o percentual para o rank estilo DMC', () => {
    expect(boostRank(125)).toMatchObject({ letter: 'A', text: 'Alright!', stage: 1 })
    expect(boostRank(150)).toMatchObject({ letter: 'S', text: 'Sweet!', stage: 2 })
    expect(boostRank(175)).toMatchObject({ letter: 'SS', text: 'Showtime!', stage: 3 })
    expect(boostRank(200)).toMatchObject({ letter: 'SSS', text: "Smokin' Sexy Style!", stage: 4 })
  })

  it('percentuais acima do teto continuam em SSS', () => {
    expect(boostRank(500)?.letter).toBe('SSS')
  })

  it('a animação só cresce com o rank', () => {
    const ranks = [125, 150, 175, 200].map((p) => boostRank(p)!)
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i].durationMs).toBeGreaterThan(ranks[i - 1].durationMs)
      expect(ranks[i].sparks).toBeGreaterThanOrEqual(ranks[i - 1].sparks)
    }
    expect(ranks.map((r) => r.edgeFlash)).toEqual([false, true, true, true])
    expect(ranks.map((r) => r.ring)).toEqual([false, false, true, true])
    expect(ranks.map((r) => r.screenFlash)).toEqual([false, false, false, true])
    expect(ranks.map((r) => r.quake)).toEqual([false, false, false, true])
    expect(ranks.map((r) => r.glitch)).toEqual([false, false, false, true])
    expect(ranks.map((r) => r.aura)).toEqual([false, false, false, true])
  })
})

describe('boostLabel', () => {
  it('formata o multiplicador', () => {
    expect(boostLabel(125)).toBe('x1.25')
    expect(boostLabel(150)).toBe('x1.5')
    expect(boostLabel(175)).toBe('x1.75')
    expect(boostLabel(200)).toBe('x2.0')
  })
})
