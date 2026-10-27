import { describe, expect, it } from 'vitest'
import { badgeArt } from './badgeArt'

// Mesma escada do catálogo do backend (internal/badge/catalog.go).
const TIERS: Record<string, number> = {
  voz: 6,
  conta: 13,
  mensagens: 5,
  streamer: 5,
  espectador: 5,
  nivel: 5,
  coruja: 4,
  madrugador: 4,
  criador: 1,
  fundador: 1,
  dono: 3,
  festeiro: 3,
  maratona: 3,
  reacoes: 3,
  contribuinte: 5,
  amigos: 5,
  bugs: 4,
  top10: 1
}

describe('badgeArt', () => {
  it('todo tier tem arte grande e pequena', () => {
    for (const [category, count] of Object.entries(TIERS)) {
      for (let tier = 1; tier <= count; tier++) {
        expect(badgeArt(category, tier, 'lg'), `${category}-${tier}`).toBeTruthy()
        expect(badgeArt(category, tier, 'sm'), `${category}-${tier}-64`).toMatch(/-64/)
      }
    }
  })

  it('tier 0 usa o primeiro; categoria desconhecida não tem arte', () => {
    expect(badgeArt('voz', 0, 'lg')).toBe(badgeArt('voz', 1, 'lg'))
    expect(badgeArt('nao-existe', 1, 'lg')).toBeUndefined()
  })
})
