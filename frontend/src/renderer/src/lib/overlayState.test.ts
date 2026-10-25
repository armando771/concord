import { describe, expect, it } from 'vitest'
import {
  buildOverlaySnapshot,
  clampOverlayOpacity,
  OVERLAY_OPACITY_DEFAULT,
  type OverlayInput
} from './overlayState'

const ana = { id: 'ana', username: 'ana', display_name: 'Ana' }
const bia = { id: 'bia', username: 'bia', display_name: 'Bia' }

function input(over: Partial<OverlayInput> = {}): OverlayInput {
  return {
    enabled: true,
    status: 'active',
    me: { id: 'eu', username: 'nico', display_name: 'Nico' },
    participants: [ana, bia],
    voiceStates: {},
    speakingIds: [],
    muted: false,
    deafened: false,
    opacity: OVERLAY_OPACITY_DEFAULT,
    ...over
  }
}

describe('buildOverlaySnapshot', () => {
  it('eu fico no topo, marcado como você', () => {
    const s = buildOverlaySnapshot(input())
    expect(s.members.map((m) => m.id)).toEqual(['eu', 'ana', 'bia'])
    expect(s.members.map((m) => m.self)).toEqual([true, false, false])
    expect(s.members[0]).toMatchObject({ name: 'Nico', initial: 'N' })
  })

  it('meu mudo/fone vem do estado local; dos outros, de voiceStates', () => {
    const s = buildOverlaySnapshot(
      input({
        muted: true,
        deafened: true,
        voiceStates: { ana: { muted: true, deafened: false } }
      })
    )
    expect(s.members[0]).toMatchObject({ muted: true, deafened: true })
    expect(s.members[1]).toMatchObject({ muted: true, deafened: false })
    expect(s.members[2]).toMatchObject({ muted: false, deafened: false })
  })

  it('quem fala aparece falando, mas mutado nunca', () => {
    const s = buildOverlaySnapshot(
      input({
        speakingIds: ['eu', 'ana', 'bia'],
        voiceStates: { ana: { muted: true, deafened: false } }
      })
    )
    expect(s.members.map((m) => m.speaking)).toEqual([true, false, true])
  })

  it('não duplica o próprio usuário se ele vier em participants', () => {
    const s = buildOverlaySnapshot(
      input({ participants: [ana, { id: 'eu', username: 'nico', display_name: 'Nico' }] })
    )
    expect(s.members.map((m) => m.id)).toEqual(['eu', 'ana'])
  })

  it('call grande: mostra 7 e "+N"', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: `u${i}`,
      username: `u${i}`,
      display_name: `U${i}`
    }))
    const s = buildOverlaySnapshot(input({ participants: many }))
    expect(s.members).toHaveLength(7)
    expect(s.members[0].self).toBe(true)
    expect(s.more).toBe(4)
  })

  it('exatamente no limite cabe todo mundo sem "+N"', () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({
      id: `u${i}`,
      username: `u${i}`,
      display_name: `U${i}`
    }))
    const s = buildOverlaySnapshot(input({ participants: seven }))
    expect(s.members).toHaveLength(8)
    expect(s.more).toBe(0)
  })

  it('fora da call ativa (ou sem login) não está em call', () => {
    expect(buildOverlaySnapshot(input({ status: 'ringing' }))).toMatchObject({
      inCall: false,
      members: [],
      more: 0
    })
    expect(buildOverlaySnapshot(input({ me: null }))).toMatchObject({
      inCall: false,
      members: []
    })
  })

  it('nome cai para username e depois "Usuário"', () => {
    const s = buildOverlaySnapshot(
      input({
        participants: [
          { id: 'x', username: 'xis', display_name: ' ' },
          { id: 'y', username: '', display_name: '' }
        ]
      })
    )
    expect(s.members.slice(1).map((m) => m.name)).toEqual(['xis', 'Usuário'])
  })

  it('leva junto a preferência de ligado/desligado', () => {
    expect(buildOverlaySnapshot(input({ enabled: false })).enabled).toBe(false)
  })
})

describe('opacidade do overlay', () => {
  it('padrão de 70%', () => {
    expect(OVERLAY_OPACITY_DEFAULT).toBe(70)
  })

  it('fica entre 20% e 100%, em passos de 5%', () => {
    expect(clampOverlayOpacity(70)).toBe(70)
    expect(clampOverlayOpacity(5)).toBe(20)
    expect(clampOverlayOpacity(150)).toBe(100)
    expect(clampOverlayOpacity(72)).toBe(70)
    expect(clampOverlayOpacity(73)).toBe(75)
  })

  it('valor salvo estragado volta ao padrão', () => {
    expect(clampOverlayOpacity(Number.NaN)).toBe(OVERLAY_OPACITY_DEFAULT)
    expect(clampOverlayOpacity(undefined as unknown as number)).toBe(OVERLAY_OPACITY_DEFAULT)
  })

  it('vai junto no estado mandado ao overlay, também fora da call', () => {
    expect(buildOverlaySnapshot(input({ opacity: 45 })).opacity).toBe(45)
    expect(buildOverlaySnapshot(input({ opacity: 3 })).opacity).toBe(20)
    expect(buildOverlaySnapshot(input({ status: 'idle', opacity: 45 })).opacity).toBe(45)
  })
})
