import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  games: {} as Record<string, unknown>,
  music: {} as Record<string, unknown>
}))
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../store/presenceActivityStore', () => ({
  usePresenceActivityStore: (sel: (s: { byUser: unknown }) => unknown) =>
    sel({ byUser: state.games })
}))
vi.mock('../store/listeningStore', () => ({
  useListeningStore: (sel: (s: { byUser: unknown }) => unknown) => sel({ byUser: state.music })
}))
vi.mock('../../profile/store/profileStore', () => ({
  useUserLook: (_id: string, fallback: unknown) => fallback,
  useProfileStore: (sel: (s: { profiles: unknown }) => unknown) => sel({ profiles: {} })
}))
vi.mock('../../../assets/nameStyle.css', () => ({}))

import { FriendsActivity } from './FriendsActivity'

const friends = [
  { id: 'a', username: 'ana', display_name: 'Ana' },
  { id: 'b', username: 'bia', display_name: 'Bia' },
  { id: 'c', username: 'caio', display_name: 'Caio' }
] as never

beforeEach(() => {
  state.games = {}
  state.music = {}
})

describe('FriendsActivity', () => {
  it('ninguém jogando nem ouvindo: some', () => {
    expect(renderToStaticMarkup(<FriendsActivity friends={friends} />)).toBe('')
  })

  it('conta quem joga e quem ouve; quem faz os dois aparece uma vez, jogando', () => {
    state.games = { a: { name: 'VALORANT', kind: 'game', started_at: 1 } }
    state.music = {
      a: { app: 'Spotify', title: 'Outra', started_at: 1 },
      b: { app: 'Spotify', title: 'Águas de Março', artist: 'Elis Regina', started_at: 2 }
    }
    const html = renderToStaticMarkup(<FriendsActivity friends={friends} />)
    expect(html).toContain('Atividade — 2')
    expect(html).toContain('VALORANT')
    expect(html).toContain('Águas de Março')
    expect(html).toContain('Elis Regina · Spotify')
    expect(html).not.toContain('Outra')
    expect(html).not.toContain('Caio')
  })
})
