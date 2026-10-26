import { describe, expect, it } from 'vitest'
import { serverRailView } from './serverRailView'

const base = { muted: false, isActive: false, mentions: 0, unread: 0, inMyCall: false, hasCall: false }

describe('serverRailView', () => {
  it('servidor quieto: sem selo, sem opacidade, sem voz', () => {
    expect(serverRailView(base)).toEqual({ dimmed: false, badge: 0, voice: null })
  })

  it('contagem ainda não carregada vale zero', () => {
    expect(serverRailView({ ...base, mentions: undefined, unread: undefined }).badge).toBe(0)
  })

  it('silenciado some o contador de não lidas, mas a menção continua', () => {
    expect(serverRailView({ ...base, muted: true, unread: 4 }).badge).toBe(0)
    expect(serverRailView({ ...base, muted: true, unread: 4, mentions: 1 }).badge).toBe(1)
  })

  it('silenciado fica apagado, exceto se ativo ou com menção', () => {
    expect(serverRailView({ ...base, muted: true }).dimmed).toBe(true)
    expect(serverRailView({ ...base, muted: true, isActive: true }).dimmed).toBe(false)
    expect(serverRailView({ ...base, muted: true, mentions: 2 }).dimmed).toBe(false)
  })

  it('selo de voz: minha call ganha de call alheia', () => {
    expect(serverRailView({ ...base, hasCall: true }).voice).toBe('active')
    expect(serverRailView({ ...base, inMyCall: true }).voice).toBe('mine')
    expect(serverRailView({ ...base, inMyCall: true, hasCall: true }).voice).toBe('mine')
  })
})
