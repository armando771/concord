import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  perms: 0,
  viewing: 'srv-a',
  server: [] as Array<Record<string, unknown>>,
  favorites: [] as Array<Record<string, unknown>>
}))

// O atalho de teclado importa o callStore (pesado, com áudio do navegador).
vi.mock('../store/callStore', () => ({ useCallStore: vi.fn() }))
vi.mock('../../servers/store/serverStore', () => ({
  useServerStore: (sel: (s: { currentServer: { id: string } }) => unknown) =>
    sel({ currentServer: { id: state.viewing } })
}))
vi.mock('../../servers/hooks/useServerAccess', () => ({
  useServerAccess: () => ({
    can: (want: number) => (state.perms & want) === want,
    canInChannel: (_: string, want: number) => (state.perms & want) === want
  })
}))
vi.mock('../../auth/store/authStore', () => ({
  useAuthStore: (sel: (s: { user: { id: string } }) => unknown) => sel({ user: { id: 'eu' } })
}))
vi.mock('../store/soundboardStore', () => ({
  useSoundboardStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      soundsByServer: { 'srv-a': state.server },
      loadingByServer: {},
      volume: 0.8,
      keybinds: {},
      activePlays: {},
      setVolume: vi.fn(),
      setKeybind: vi.fn(),
      loadServerSounds: vi.fn(),
      deleteSound: vi.fn(),
      triggerSound: vi.fn()
    })
}))
vi.mock('../store/soundFavoritesStore', () => ({
  useSoundFavoritesStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ favorites: state.favorites, load: vi.fn(), toggle: vi.fn() })
}))
vi.mock('./SoundboardUploadModal', () => ({ default: () => null }))

import { renderToStaticMarkup } from 'react-dom/server'
import SoundboardSoundsPanel from './SoundboardSoundsPanel'
import { Perm } from '../../servers/lib/permissions'

const sound = (id: string, name: string, server = 'srv-a'): Record<string, unknown> => ({
  id,
  name,
  server_id: server,
  uploader_id: 'ana',
  uploader_name: 'Ana',
  content_type: 'audio/wav',
  size_bytes: 1,
  duration_ms: 1500,
  created_at: ''
})

const render = (): string =>
  renderToStaticMarkup(<SoundboardSoundsPanel serverId="srv-a" onBusyChange={() => {}} />)

describe('SoundboardSoundsPanel', () => {
  it('mostra os favoritos (com o servidor de origem) e os sons do servidor', () => {
    state.perms = Perm.ADD_SOUNDS | Perm.USE_SOUNDBOARD
    state.server = [sound('a1', 'Buzina'), sound('a2', 'Corneta')]
    state.favorites = [
      { ...sound('b1', 'Bateria', 'srv-b'), server_name: 'Servidor B' },
      { ...sound('a2', 'Corneta'), server_name: 'Servidor A' }
    ]
    const html = render()
    expect(html).toContain('Favoritos')
    expect(html).toContain('Sons do servidor')
    expect(html).toContain('Servidor B')
    // O favorito daqui não repete na seção do servidor.
    expect(html.match(/>Corneta</g)?.length).toBe(1)
    expect(html.indexOf('Bateria')).toBeLessThan(html.indexOf('Buzina'))
    expect(html.match(/Remover dos favoritos/g)?.length).toBe(4) // aria-label + title, x2
    expect(html).toContain('Favoritar som')
  })

  it('sem "Adicionar sons" esconde o envio', () => {
    state.perms = Perm.USE_SOUNDBOARD
    state.server = []
    state.favorites = []
    const html = render()
    expect(html).not.toContain('Adicionar som')
    expect(html).toContain('Nenhum som neste servidor ainda.')
  })

  it('com "Adicionar sons" mostra o envio', () => {
    state.perms = Perm.ADD_SOUNDS
    expect(render()).toContain('Adicionar som')
  })

  it('favorito de outro servidor não tem lixeira aqui', () => {
    state.perms = Perm.MANAGE_EXPRESSIONS
    state.server = []
    state.favorites = [{ ...sound('b1', 'Bateria', 'srv-b'), server_name: 'Servidor B' }]
    expect(render()).not.toContain('Excluir som')
  })
})
