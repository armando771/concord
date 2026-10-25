import { describe, expect, it } from 'vitest'
import { formatMemberSince, placeProfileCard } from './profileCard'

const card = { width: 300, height: 360 }
const viewport = { width: 1280, height: 800 }

describe('placeProfileCard', () => {
  it('lista de membros (direita): abre à esquerda do item', () => {
    const anchor = { top: 100, left: 1040, right: 1270, bottom: 144 }
    expect(placeProfileCard(anchor, 'left', card, viewport)).toEqual({ left: 732, top: 100 })
  })

  it('canal de voz (esquerda): abre à direita do item', () => {
    const anchor = { top: 300, left: 80, right: 310, bottom: 328 }
    expect(placeProfileCard(anchor, 'right', card, viewport)).toEqual({ left: 318, top: 300 })
  })

  it('sem espaço no lado preferido, vai para o outro', () => {
    const anchor = { top: 100, left: 20, right: 200, bottom: 130 }
    expect(placeProfileCard(anchor, 'left', card, viewport).left).toBe(208)
  })

  it('nunca passa da parte de baixo nem de cima da janela', () => {
    const low = { top: 760, left: 1040, right: 1270, bottom: 790 }
    expect(placeProfileCard(low, 'left', card, viewport).top).toBe(800 - 360 - 8)
    const tiny = placeProfileCard(low, 'left', card, { width: 1280, height: 300 })
    expect(tiny.top).toBe(8)
  })
})

describe('formatMemberSince', () => {
  it('formata a data e ignora vazio/inválido', () => {
    expect(formatMemberSince('2026-10-25T12:00:00Z')).toMatch(/2026/)
    expect(formatMemberSince(undefined)).toBeNull()
    expect(formatMemberSince('xx')).toBeNull()
  })
})
