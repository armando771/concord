import { describe, expect, it } from 'vitest'
import {
  buildOverlaySnapshot,
  clampOverlayOpacity,
  migrateOverlayPrefs,
  OVERLAY_OPACITY_DEFAULT,
  overlayRowOpacity,
  type OverlayInput
} from './overlayState'
import { OVERLAY_DEFAULT_LAYOUT } from './overlayLayout'

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
    layout: OVERLAY_DEFAULT_LAYOUT,
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
  it('padrão de 30% em repouso', () => {
    expect(OVERLAY_OPACITY_DEFAULT).toBe(30)
  })

  it('repouso fica entre 10% e 60%, em passos de 5%', () => {
    expect(clampOverlayOpacity(30)).toBe(30)
    expect(clampOverlayOpacity(5)).toBe(10)
    expect(clampOverlayOpacity(0)).toBe(10)
    expect(clampOverlayOpacity(150)).toBe(60)
    expect(clampOverlayOpacity(32)).toBe(30)
    expect(clampOverlayOpacity(33)).toBe(35)
  })

  it('valor salvo estragado volta ao padrão', () => {
    expect(clampOverlayOpacity(Number.NaN)).toBe(OVERLAY_OPACITY_DEFAULT)
    expect(clampOverlayOpacity(undefined as unknown as number)).toBe(OVERLAY_OPACITY_DEFAULT)
  })

  it('vai junto no estado mandado ao overlay, também fora da call', () => {
    expect(buildOverlaySnapshot(input({ opacity: 45 })).opacity).toBe(45)
    expect(buildOverlaySnapshot(input({ opacity: 3 })).opacity).toBe(10)
    expect(buildOverlaySnapshot(input({ opacity: 90 })).opacity).toBe(60)
    expect(buildOverlaySnapshot(input({ status: 'idle', opacity: 45 })).opacity).toBe(45)
  })
})

describe('posição/tamanho do overlay no estado', () => {
  it('vai junto, também fora da call', () => {
    const layout = { position: { x: 0.4, y: 0.6 }, scale: 1.3 }
    expect(buildOverlaySnapshot(input({ layout })).layout).toEqual(layout)
    expect(buildOverlaySnapshot(input({ status: 'idle', layout })).layout).toEqual(layout)
  })

  it('valor salvo estragado vira o padrão', () => {
    expect(
      buildOverlaySnapshot(input({ layout: { position: { x: 3, y: -1 }, scale: 9 } })).layout
    ).toEqual({ position: { x: 1, y: 0 }, scale: 1.6 })
    expect(buildOverlaySnapshot(input({ layout: undefined as never })).layout).toEqual(
      OVERLAY_DEFAULT_LAYOUT
    )
  })
})

describe('overlayRowOpacity', () => {
  it('quem não fala fica na opacidade de repouso', () => {
    expect(overlayRowOpacity(30, false)).toBe(30)
    expect(overlayRowOpacity(10, false)).toBe(10)
  })

  it('quem fala ganha +40', () => {
    expect(overlayRowOpacity(30, true)).toBe(70)
    expect(overlayRowOpacity(10, true)).toBe(50)
  })

  it('quem fala para em 85%, nunca 100%', () => {
    expect(overlayRowOpacity(45, true)).toBe(85)
    expect(overlayRowOpacity(60, true)).toBe(85)
    expect(overlayRowOpacity(100, true)).toBe(85)
    expect(overlayRowOpacity(100, false)).toBe(60)
  })

  it('valor estragado usa o padrão', () => {
    expect(overlayRowOpacity(Number.NaN, false)).toBe(OVERLAY_OPACITY_DEFAULT)
    expect(overlayRowOpacity(Number.NaN, true)).toBe(OVERLAY_OPACITY_DEFAULT + 40)
  })
})

describe('migrateOverlayPrefs', () => {
  it('opacidade antiga (20–100%) é encaixada na faixa nova', () => {
    expect(migrateOverlayPrefs({ enabled: true, opacity: 70 })).toEqual({
      enabled: true,
      opacity: 60
    })
    expect(migrateOverlayPrefs({ enabled: false, opacity: 20 })).toEqual({
      enabled: false,
      opacity: 20
    })
    expect(migrateOverlayPrefs({ enabled: true, opacity: 100 }).opacity).toBe(60)
  })

  it('sem opacidade salva (ou estragada) fica com o padrão; o resto é mantido', () => {
    expect(migrateOverlayPrefs({ enabled: false })).toEqual({
      enabled: false,
      opacity: OVERLAY_OPACITY_DEFAULT
    })
    expect(migrateOverlayPrefs({ opacity: 'x' }).opacity).toBe(OVERLAY_OPACITY_DEFAULT)
  })

  it('nada salvo não quebra', () => {
    expect(migrateOverlayPrefs(undefined)).toEqual({ opacity: OVERLAY_OPACITY_DEFAULT })
    expect(migrateOverlayPrefs(null)).toEqual({ opacity: OVERLAY_OPACITY_DEFAULT })
  })
})
