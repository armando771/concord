import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  activity: null as Record<string, unknown> | null,
  listening: null as Record<string, unknown> | null,
  now: 0
}))
vi.mock('../store/presenceActivityStore', () => ({ useActivity: () => state.activity }))
vi.mock('../store/listeningStore', () => ({ useListening: () => state.listening }))
vi.mock('../../../shared/hooks/useNow', () => ({ useNow: () => state.now }))

import { ProfileActivities } from './ProfileActivities'

const render = (): string => renderToStaticMarkup(<ProfileActivities userId="u1" />)

beforeEach(() => {
  state.activity = null
  state.listening = null
  state.now = 0
})

describe('ProfileActivities', () => {
  it('sem jogo nem música, nada', () => {
    expect(render()).toBe('')
  })

  it('"Ouvindo Spotify" com música, artista, álbum e "1:23 ━━━── 3:45"', () => {
    state.listening = {
      app: 'Spotify',
      title: 'Águas de Março',
      artist: 'Elis Regina',
      album: 'Elis & Tom',
      started_at: 1000,
      duration_ms: 225_000
    }
    state.now = 1000 + 83_000
    const html = render()
    expect(html).toContain('Ouvindo Spotify')
    expect(html).toContain('Águas de Março')
    expect(html).toContain('Elis Regina')
    expect(html).toContain('Elis &amp; Tom')
    expect(html).toContain('<span>1:23</span>')
    expect(html).toContain('<span>3:45</span>')
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-valuenow="37"')
    expect(html).toContain('aria-valuetext="1:23 de 3:45"')
  })

  it('sem duração, só o tempo decorrido; jogo e música juntos', () => {
    state.activity = { name: 'VALORANT', kind: 'game', started_at: 0 }
    state.listening = { app: 'Rádio', title: 'Ao vivo', started_at: 0 }
    state.now = 61_000
    const html = render()
    expect(html).toContain('Jogando agora')
    expect(html).toContain('Ouvindo Rádio')
    expect(html).toContain('>1:01</p>')
    expect(html).not.toContain('progressbar')
    expect(html.indexOf('Jogando agora')).toBeLessThan(html.indexOf('Ouvindo Rádio'))
  })
})
