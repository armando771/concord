import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import OverlayList from './OverlayList'
import type { OverlayMember, OverlaySnapshot } from '../features/overlay/lib/overlayState'

const member = (over: Partial<OverlayMember> = {}): OverlayMember => ({
  id: 'eu',
  name: 'Nico',
  initial: 'N',
  avatarUrl: null,
  avatarAnimatedUrl: null,
  self: true,
  muted: false,
  deafened: false,
  speaking: false,
  watchingMe: false,
  ...over
})

const snapshot = (over: Partial<OverlaySnapshot> = {}): OverlaySnapshot => ({
  enabled: true,
  inCall: true,
  members: [member(), member({ id: 'ana', name: 'Ana', self: false })],
  more: 0,
  viewers: null,
  opacity: 30,
  layout: { position: null, scale: 1 },
  shortcut: 'Shift+Tab',
  ...over
})

const eyes = (html: string): number => (html.match(/Assistindo a sua live/g) ?? []).length

describe('OverlayList', () => {
  it('sem live: nenhuma pílula tem olho e não há selo', () => {
    const html = renderToStaticMarkup(<OverlayList snapshot={snapshot()} />)
    expect(eyes(html)).toBe(0)
    expect(html).not.toContain('assistindo a sua live')
  })

  it('com live: olho só em quem assiste e selo com a contagem', () => {
    const s = snapshot({
      viewers: 1,
      members: [member(), member({ id: 'ana', name: 'Ana', self: false, watchingMe: true })]
    })
    const html = renderToStaticMarkup(<OverlayList snapshot={s} />)
    expect(eyes(html)).toBe(1)
    expect(html).toContain('1 pessoa assistindo a sua live')
  })

  it('o "+N" continua aparecendo antes do selo', () => {
    const html = renderToStaticMarkup(<OverlayList snapshot={snapshot({ more: 3, viewers: 5 })} />)
    expect(html.indexOf('+3')).toBeGreaterThan(-1)
    expect(html.indexOf('+3')).toBeLessThan(html.indexOf('5 pessoas'))
  })
})
