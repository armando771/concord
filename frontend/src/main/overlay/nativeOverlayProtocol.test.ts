import { describe, expect, it } from 'vitest'
import type { OverlayMember, OverlaySnapshot } from '../../renderer/src/features/overlay/lib/overlayState'
import {
  NATIVE_HIDDEN_LINE,
  nativeMemberAvatar,
  nativeStateLine,
  parseNativeOverlayEvent,
  type NativeOverlayView
} from './nativeOverlayProtocol'

const member = (over: Partial<OverlayMember> = {}): OverlayMember => ({
  id: 'eu',
  name: 'Nico',
  initial: 'N',
  avatarUrl: 'http://srv/api/profile-media/1',
  avatarAnimatedUrl: null,
  self: true,
  muted: false,
  deafened: false,
  speaking: true,
  watchingMe: false,
  ...over
})

const snapshot = (over: Partial<OverlaySnapshot> = {}): OverlaySnapshot => ({
  enabled: true,
  inCall: true,
  members: [member()],
  more: 2,
  viewers: null,
  opacity: 35,
  layout: { position: { x: 0.25, y: 0.5 }, scale: 1.2 },
  shortcut: 'Shift+Tab',
  theme: { floating: '#111214' },
  ...over
})

const files: Record<string, string | null | undefined> = {
  'http://srv/api/profile-media/1': 'C:\\cache\\1',
  'http://srv/api/profile-media/a_2': 'C:\\cache\\a_2',
  'http://srv/api/profile-media/a_2/static': 'C:\\cache\\a_2s',
  'http://srv/api/profile-media/falhou': null,
  'http://srv/api/profile-media/baixando': undefined
}
const view = (over: Partial<NativeOverlayView> = {}): NativeOverlayView => ({
  snapshot: snapshot(),
  foreground: { pid: 4242, monitor: { x: -1920, y: 0, width: 1920, height: 1080 } },
  visible: true,
  editing: false,
  avatarPath: (url) => files[url],
  ...over
})

describe('nativeStateLine', () => {
  it('estado inteiro numa linha de JSON', () => {
    const line = nativeStateLine(view())
    expect(line).not.toContain('\n')
    expect(JSON.parse(line)).toEqual({
      type: 'state',
      visible: true,
      editing: false,
      game: 4242,
      monitor: { x: -1920, y: 0, width: 1920, height: 1080 },
      opacity: 35,
      layout: { position: { x: 0.25, y: 0.5 }, scale: 1.2 },
      hint: '',
      theme: { floating: '#111214' },
      members: [
        {
          id: 'eu',
          name: 'Nico',
          initial: 'N',
          avatar: 'C:\\cache\\1',
          animated: false,
          tag: 'VOCÊ',
          muted: false,
          deafened: false,
          speaking: true,
          watching: false
        }
      ],
      more: 2,
      viewers: null
    })
  })

  it('espectadores da minha live: contagem no estado e olho em cada membro', () => {
    const line = JSON.parse(
      nativeStateLine(
        view({
          snapshot: snapshot({
            viewers: 3,
            members: [member({ self: true }), member({ id: 'ana', self: false, watchingMe: true })]
          })
        })
      )
    )
    expect(line.viewers).toBe(3)
    expect(line.members.map((m: { watching: boolean }) => m.watching)).toEqual([false, true])
  })

  it('editando leva a dica com o atalho configurado', () => {
    const line = JSON.parse(nativeStateLine(view({ editing: true, snapshot: snapshot({ shortcut: 'Ctrl+Shift+O' }) })))
    expect(line.editing).toBe(true)
    expect(line.hint).toContain('Ctrl+Shift+O ou Esc')
  })

  it('oculto, sem jogo ou fora da call: uma linha curta e sempre a mesma', () => {
    expect(nativeStateLine(view({ visible: false }))).toBe(NATIVE_HIDDEN_LINE)
    expect(nativeStateLine(view({ foreground: null }))).toBe(NATIVE_HIDDEN_LINE)
    expect(nativeStateLine(view({ snapshot: null }))).toBe(NATIVE_HIDDEN_LINE)
    expect(nativeStateLine(view({ snapshot: snapshot({ inCall: false }) }))).toBe(NATIVE_HIDDEN_LINE)
    expect(JSON.parse(NATIVE_HIDDEN_LINE)).toEqual({ type: 'state', visible: false })
  })

  it('layout estragado vai normalizado; sem tema não manda o campo', () => {
    const line = JSON.parse(
      nativeStateLine(view({ snapshot: snapshot({ layout: { position: { x: 9, y: 0 }, scale: 7 }, theme: null }) }))
    )
    expect(line.layout).toEqual({ position: { x: 1, y: 0 }, scale: 1.6 })
    expect(line).not.toHaveProperty('theme')
  })

  it('outros não ganham etiqueta', () => {
    const line = JSON.parse(nativeStateLine(view({ snapshot: snapshot({ members: [member({ self: false })] }) })))
    expect(line.members[0].tag).toBeNull()
  })
})

describe('nativeMemberAvatar', () => {
  const gif = member({
    avatarUrl: 'http://srv/api/profile-media/a_2/static',
    avatarAnimatedUrl: 'http://srv/api/profile-media/a_2'
  })
  const path = (url: string): string | null | undefined => files[url]

  it('GIF: manda o animado (o helper mostra o 1º quadro para quem não fala)', () => {
    expect(nativeMemberAvatar(gif, path)).toEqual({ avatar: 'C:\\cache\\a_2', animated: true })
  })

  it('GIF que falhou cai na imagem parada; ainda baixando, a inicial', () => {
    const failed = { ...gif, avatarAnimatedUrl: 'http://srv/api/profile-media/falhou' }
    expect(nativeMemberAvatar(failed, path)).toEqual({ avatar: 'C:\\cache\\a_2s', animated: false })
    const pending = { ...gif, avatarAnimatedUrl: 'http://srv/api/profile-media/baixando' }
    expect(nativeMemberAvatar(pending, path)).toEqual({ avatar: null, animated: false })
  })

  it('imagem parada, sem avatar, ou que falhou', () => {
    expect(nativeMemberAvatar(member(), path)).toEqual({ avatar: 'C:\\cache\\1', animated: false })
    expect(nativeMemberAvatar(member({ avatarUrl: null }), path)).toEqual({ avatar: null, animated: false })
    const failed = member({ avatarUrl: 'http://srv/api/profile-media/falhou' })
    expect(nativeMemberAvatar(failed, path)).toEqual({ avatar: null, animated: false })
  })
})

describe('parseNativeOverlayEvent', () => {
  it('pronto, posição nova (normalizada) e erro', () => {
    expect(parseNativeOverlayEvent('{"type":"ready"}')).toEqual({ type: 'ready' })
    expect(
      parseNativeOverlayEvent('{"type":"layout","layout":{"position":{"x":0.5,"y":2},"scale":1.23}}\r')
    ).toEqual({ type: 'layout', layout: { position: { x: 0.5, y: 1 }, scale: 1.25 } })
    expect(parseNativeOverlayEvent('{"type":"error","message":"falhou"}')).toEqual({
      type: 'error',
      message: 'falhou'
    })
  })

  it('o que não entende é null', () => {
    expect(parseNativeOverlayEvent('lixo')).toBeNull()
    expect(parseNativeOverlayEvent('{"type":"futuro"}')).toBeNull()
    expect(parseNativeOverlayEvent('{"type":"error"}')).toEqual({ type: 'error', message: '' })
    expect(parseNativeOverlayEvent('null')).toBeNull()
  })
})
