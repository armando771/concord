import { describe, expect, it } from 'vitest'
import {
  buildOverlaySnapshot,
  clampOverlayOpacity,
  migrateOverlayPrefs,
  normalizeOverlayPrefs,
  OVERLAY_PREFS_VERSION,
  OVERLAY_OPACITY_DEFAULT,
  overlayRowOpacity,
  overlayAvatarSrc,
  sameOverlaySnapshot,
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
    shortcut: 'Shift+Tab',
    mediaBase: 'http://srv:8080/api',
    ...over
  }
}

describe('overlayAvatarSrc', () => {
  const gif = { speaking: false, avatarUrl: '/s', avatarAnimatedUrl: '/a' }

  it('quem fala anima; os outros ficam parados', () => {
    expect(overlayAvatarSrc(gif, null)).toBe('/s')
    expect(overlayAvatarSrc({ ...gif, speaking: true }, null)).toBe('/a')
  })

  it('sem versão animada usa a imagem; sem avatar ou com erro, a inicial', () => {
    expect(overlayAvatarSrc({ speaking: true, avatarUrl: '/p', avatarAnimatedUrl: null }, null)).toBe('/p')
    expect(overlayAvatarSrc({ speaking: true, avatarUrl: null, avatarAnimatedUrl: null }, null)).toBeNull()
    expect(overlayAvatarSrc({ ...gif, speaking: true }, '/a')).toBeNull()
  })
})

describe('sameOverlaySnapshot', () => {
  it('igual por conteúdo, não por identidade', () => {
    expect(sameOverlaySnapshot(buildOverlaySnapshot(input()), buildOverlaySnapshot(input()))).toBe(
      true
    )
  })

  it('muda quando alguém fala ou não há anterior', () => {
    const a = buildOverlaySnapshot(input())
    expect(sameOverlaySnapshot(null, a)).toBe(false)
    expect(sameOverlaySnapshot(a, buildOverlaySnapshot(input({ speakingIds: ['ana'] })))).toBe(false)
  })
})

describe('buildOverlaySnapshot', () => {
  it('avatar vira URL absoluta (a janela do overlay não é a origem da API)', () => {
    const s = buildOverlaySnapshot(
      input({
        me: { id: 'eu', username: 'nico', display_name: 'Nico', avatar_url: '/api/profile-media/u1' },
        participants: [
          { ...ana, avatar_url: '/api/profile-media/a_u2' },
          { ...bia, avatar_url: 'https://cdn.x/b.png' },
          { id: 'cai', username: 'cai', display_name: 'Cai' }
        ]
      })
    )
    expect(s.members.map((m) => m.avatarUrl)).toEqual([
      'http://srv:8080/api/profile-media/u1',
      'http://srv:8080/api/profile-media/a_u2/static',
      'https://cdn.x/b.png',
      null
    ])
  })

  it('GIF só tem versão animada à parte (anima só quem fala, poupa FPS do jogo)', () => {
    const s = buildOverlaySnapshot(
      input({
        me: { id: 'eu', username: 'nico', display_name: 'Nico', avatar_url: '/api/profile-media/u1' },
        participants: [{ ...ana, avatar_url: '/api/profile-media/a_u2' }]
      })
    )
    expect(s.members.map((m) => m.avatarAnimatedUrl)).toEqual([
      null,
      'http://srv:8080/api/profile-media/a_u2'
    ])
  })

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
  it('versão 2: atalho configurável (v1: opacidade em repouso)', () => {
    expect(OVERLAY_PREFS_VERSION).toBe(2)
  })

  it('opacidade salva antes da v1 (20–100% na lista toda) volta para 30%; o resto é mantido', () => {
    expect(migrateOverlayPrefs({ enabled: true, opacity: 70 }, 0)).toMatchObject({
      enabled: true,
      opacity: 30
    })
    expect(migrateOverlayPrefs({ enabled: false, opacity: 20 }, 0)).toMatchObject({
      enabled: false,
      opacity: 30
    })
    expect(migrateOverlayPrefs({ opacity: 45 }, 0).opacity).toBe(30)
  })

  it('opacidade salva da v1 em diante é mantida, encaixada em 10–60%', () => {
    expect(migrateOverlayPrefs({ enabled: true, opacity: 45 }, 1)).toMatchObject({
      enabled: true,
      opacity: 45
    })
    expect(migrateOverlayPrefs({ opacity: 90 }, 1).opacity).toBe(60)
    expect(migrateOverlayPrefs({ opacity: 3 }, 2).opacity).toBe(10)
    expect(migrateOverlayPrefs({ opacity: 'x' }, 1).opacity).toBe(OVERLAY_OPACITY_DEFAULT)
  })

  it('antes da v2 não havia atalho: fica o padrão (Shift+Tab)', () => {
    expect(migrateOverlayPrefs({ opacity: 30 }, 0).shortcut).toBe('Shift+Tab')
    expect(migrateOverlayPrefs({ opacity: 30, shortcut: 'Ctrl+Shift+O' }, 1).shortcut).toBe(
      'Shift+Tab'
    )
  })

  it('da v2 em diante, o atalho salvo é mantido; inválido volta ao padrão', () => {
    expect(migrateOverlayPrefs({ shortcut: 'ctrl+shift+o' }, 2).shortcut).toBe('Ctrl+Shift+O')
    expect(migrateOverlayPrefs({ shortcut: 'Tab' }, 2).shortcut).toBe('Shift+Tab')
  })

  it('nada salvo não quebra', () => {
    expect(migrateOverlayPrefs(undefined, 0)).toMatchObject({
      opacity: OVERLAY_OPACITY_DEFAULT,
      shortcut: 'Shift+Tab'
    })
    expect(migrateOverlayPrefs(null, 1)).toMatchObject({ opacity: OVERLAY_OPACITY_DEFAULT })
  })
})

describe('normalizeOverlayPrefs (a cada carga, mesmo sem mudar de versão)', () => {
  it('encaixa opacidade, posição/tamanho e atalho; mantém o resto', () => {
    expect(
      normalizeOverlayPrefs({
        enabled: false,
        opacity: 99,
        layout: { position: { x: 2, y: 0.5 }, scale: 9 },
        shortcut: 'O'
      })
    ).toEqual({
      enabled: false,
      showWatchers: true,
      opacity: 60,
      layout: { position: { x: 1, y: 0.5 }, scale: 1.6 },
      shortcut: 'Shift+Tab'
    })
  })

  it('layout estragado (ex.: null) vira o padrão em vez de quebrar a tela de configurações', () => {
    expect(normalizeOverlayPrefs({ layout: null }).layout).toEqual(OVERLAY_DEFAULT_LAYOUT)
    expect(normalizeOverlayPrefs(undefined)).toEqual({
      showWatchers: true,
      opacity: OVERLAY_OPACITY_DEFAULT,
      layout: OVERLAY_DEFAULT_LAYOUT,
      shortcut: 'Shift+Tab'
    })
  })
})

describe('atalho no estado do overlay', () => {
  it('vai junto, normalizado, também fora da call', () => {
    expect(buildOverlaySnapshot(input({ shortcut: 'alt+f9' })).shortcut).toBe('Alt+F9')
    expect(buildOverlaySnapshot(input({ status: 'idle', shortcut: 'Tab' })).shortcut).toBe(
      'Shift+Tab'
    )
  })
})

describe('buildOverlaySnapshot: tema', () => {
  it('leva as cores do tema (dentro e fora da call); sem tema, null', () => {
    const theme = { floating: '#111214', brand: '#5865f2' }
    expect(buildOverlaySnapshot(input({ theme })).theme).toEqual(theme)
    expect(buildOverlaySnapshot(input({ theme, status: 'idle' })).theme).toEqual(theme)
    expect(buildOverlaySnapshot(input({ theme }), 2).theme).toEqual(theme)
    expect(buildOverlaySnapshot(input()).theme).toBeNull()
  })
})

describe('buildOverlaySnapshot: quem assiste a minha live', () => {
  const live = { live: true, show: true, watchers: [bia] }

  it('sem live não tem contagem nem olho em ninguém', () => {
    const s = buildOverlaySnapshot(input({ liveWatchers: { ...live, live: false } }))
    expect(s.viewers).toBeNull()
    expect(s.members.some((m) => m.watchingMe)).toBe(false)
  })

  it('com live: conta e marca só quem assiste', () => {
    const s = buildOverlaySnapshot(input({ liveWatchers: live }))
    expect(s.viewers).toBe(1)
    expect(s.members.map((m) => m.watchingMe)).toEqual([false, false, true])
  })

  it('opção desligada esconde tudo', () => {
    const s = buildOverlaySnapshot(input({ liveWatchers: { ...live, show: false } }))
    expect(s.viewers).toBeNull()
    expect(s.members.some((m) => m.watchingMe)).toBe(false)
  })

  it('quem assiste e ficou no "+N" ainda entra na contagem', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: `u${i}`,
      username: `u${i}`,
      display_name: `U${i}`
    }))
    const s = buildOverlaySnapshot(
      input({ participants: many, liveWatchers: { ...live, watchers: [many[9], many[0]] } })
    )
    expect(s.more).toBeGreaterThan(0)
    expect(s.viewers).toBe(2)
    expect(s.members.filter((m) => m.watchingMe).map((m) => m.id)).toEqual(['u0'])
  })

  it('fora da call, nada', () => {
    const s = buildOverlaySnapshot(input({ status: 'idle', liveWatchers: live }))
    expect(s.viewers).toBeNull()
  })

  it('quem passa a assistir muda o snapshot (vai ao overlay)', () => {
    const a = buildOverlaySnapshot(input({ liveWatchers: { ...live, watchers: [] } }))
    const b = buildOverlaySnapshot(input({ liveWatchers: live }))
    expect(sameOverlaySnapshot(a, b)).toBe(false)
  })
})

describe('preferências do overlay: mostrar quem assiste', () => {
  it('padrão ligado; só false explícito desliga', () => {
    expect(normalizeOverlayPrefs({}).showWatchers).toBe(true)
    expect(normalizeOverlayPrefs({ showWatchers: false }).showWatchers).toBe(false)
    expect(normalizeOverlayPrefs({ showWatchers: 'lixo' }).showWatchers).toBe(true)
  })
})
