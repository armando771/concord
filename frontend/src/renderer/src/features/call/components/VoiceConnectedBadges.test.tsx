import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const boost = vi.hoisted(() => ({ percent: 100 }))
vi.mock('../../levels/hooks/useMyBoost', () => ({ useMyBoostPercent: () => boost.percent }))
vi.mock('../store/callStore', () => ({
  useCallStore: <T,>(pick: (s: { startedAt: number; muted: boolean; deafened: boolean }) => T): T =>
    pick({ startedAt: Date.now(), muted: false, deafened: false })
}))

import VoiceConnectedBadges from './VoiceConnectedBadges'

describe('VoiceConnectedBadges', () => {
  beforeEach(() => {
    boost.percent = 100
  })

  it('com buff de XP não mostra o rank de estilo por cima da chamada', () => {
    boost.percent = 175
    const html = renderToStaticMarkup(<VoiceConnectedBadges />)

    expect(html).toContain('Voz conectada')
    expect(html).not.toContain('Showtime!')
    expect(html).not.toContain('XP x1.75')
  })

  it('a aura do boost continua no rank máximo', () => {
    boost.percent = 200
    expect(renderToStaticMarkup(<VoiceConnectedBadges />)).toContain('boost-aura')
  })

  it('sem buff, nem aura', () => {
    expect(renderToStaticMarkup(<VoiceConnectedBadges />)).not.toContain('boost-aura')
  })
})
