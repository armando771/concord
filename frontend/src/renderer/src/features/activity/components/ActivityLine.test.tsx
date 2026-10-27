import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Os stores de verdade puxam o chat e a call: aqui cada teste escolhe o estado.
const state = vi.hoisted(() => ({
  activity: null as Record<string, unknown> | null,
  listening: null as Record<string, unknown> | null,
  inVoice: false
}))
vi.mock('../store/presenceActivityStore', () => ({
  useActivity: () => state.activity,
  useInVoice: () => state.inVoice
}))
vi.mock('../store/listeningStore', () => ({ useListening: () => state.listening }))

import { ActivityLine, CompactActivityLine, GameBadge } from './ActivityLine'

const song = { app: 'Spotify', title: 'Águas de Março', artist: 'Elis Regina', started_at: 0 }
const game = { name: 'VALORANT', kind: 'game', started_at: 0 }

beforeEach(() => {
  state.activity = null
  state.listening = null
  state.inVoice = false
})

describe('ActivityLine', () => {
  it('música: ícone, "Ouvindo <música>" e a dica completa', () => {
    state.listening = song
    state.inVoice = true
    const html = renderToStaticMarkup(<ActivityLine userId="u1" statusLabel="Online" />)
    expect(html).toContain('Ouvindo Águas de Março</span>')
    expect(html).toContain('title="Ouvindo Águas de Março, de Elis Regina (Spotify)"')
    expect(html).toContain('color:#1ed760')
  })

  it('jogo vence a música', () => {
    state.activity = game
    state.listening = song
    const html = renderToStaticMarkup(<ActivityLine userId="u1" statusLabel="Online" />)
    expect(html).toContain('VALORANT')
    expect(html).not.toContain('Ouvindo')
  })

  it('em voz fica verde; sem nada, o status', () => {
    state.inVoice = true
    expect(renderToStaticMarkup(<ActivityLine userId="u1" statusLabel="Online" />)).toContain(
      'text-success'
    )
    state.inVoice = false
    const html = renderToStaticMarkup(<ActivityLine userId="u1" note="  " statusLabel="Online" />)
    expect(html).toContain('>Online</span>')
    expect(html).not.toContain('<svg')
  })
})

describe('CompactActivityLine', () => {
  it('jogo; sem jogo, a música; sem nada, nada', () => {
    state.activity = game
    expect(renderToStaticMarkup(<CompactActivityLine userId="u1" />)).toContain('VALORANT')
    state.activity = null
    state.listening = { ...song, app: 'Deezer' }
    const html = renderToStaticMarkup(<CompactActivityLine userId="u1" />)
    expect(html).toContain('Ouvindo Águas de Março')
    expect(html).toContain('color:#a238ff')
    state.listening = null
    expect(renderToStaticMarkup(<CompactActivityLine userId="u1" />)).toBe('')
  })
})

describe('GameBadge', () => {
  it('só o jogo', () => {
    expect(renderToStaticMarkup(<GameBadge userId="u1" />)).toBe('')
    state.activity = game
    expect(renderToStaticMarkup(<GameBadge userId="u1" />)).toContain('Jogando VALORANT')
  })
})
