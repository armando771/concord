import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  server: [] as string[],
  fail: new Set<string>(),
  calls: [] as string[]
}))

vi.mock('../api/soundFavorites', () => {
  const item = (id: string): Record<string, unknown> => ({
    id,
    server_id: id.startsWith('b') ? 'srv-b' : 'srv-a',
    server_name: id.startsWith('b') ? 'Servidor B' : 'Servidor A',
    uploader_id: 'u',
    uploader_name: 'Ana',
    name: id,
    content_type: 'audio/wav',
    size_bytes: 1,
    duration_ms: 1000,
    created_at: ''
  })
  const list = async (): Promise<Array<Record<string, unknown>>> => api.server.map(item)
  return {
    listFavoriteSounds: vi.fn(async () => {
      api.calls.push('list')
      return list()
    }),
    addFavoriteSound: vi.fn(async (id: string) => {
      api.calls.push('add:' + id)
      if (api.fail.has(id)) throw new Error('sound not found')
      if (!api.server.includes(id)) api.server.unshift(id)
      return list()
    }),
    removeFavoriteSound: vi.fn(async (id: string) => {
      api.calls.push('remove:' + id)
      api.server = api.server.filter((x) => x !== id)
      return list()
    })
  }
})

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    }
  }
}

const PREFS = 'concord:soundboard-prefs'

beforeEach(() => {
  globalThis.localStorage = memoryStorage()
  api.server = []
  api.fail.clear()
  api.calls = []
  vi.resetModules()
})

describe('soundFavoritesStore', () => {
  it('carrega os favoritos do servidor, com o servidor de origem', async () => {
    api.server = ['b1', 'a1']
    const { useSoundFavoritesStore } = await import('./soundFavoritesStore')
    await useSoundFavoritesStore.getState().load()
    const { favorites, loaded } = useSoundFavoritesStore.getState()
    expect(loaded).toBe(true)
    expect(favorites.map((f) => [f.id, f.server_name])).toEqual([
      ['b1', 'Servidor B'],
      ['a1', 'Servidor A']
    ])
  })

  it('a estrela liga e desliga pelo servidor', async () => {
    const { useSoundFavoritesStore } = await import('./soundFavoritesStore')
    const store = useSoundFavoritesStore.getState()
    await store.toggle('a1')
    expect(useSoundFavoritesStore.getState().favorites.map((f) => f.id)).toEqual(['a1'])
    await useSoundFavoritesStore.getState().toggle('a1')
    expect(useSoundFavoritesStore.getState().favorites).toEqual([])
    expect(api.calls).toEqual(['add:a1', 'remove:a1'])
  })

  it('leva os favoritos antigos do localStorage para o servidor uma vez', async () => {
    localStorage.setItem(
      PREFS,
      JSON.stringify({ volume: 0.5, favorites: ['a1', 'sumido'], keybinds: { a1: 'F1' } })
    )
    api.fail.add('sumido')
    const { useSoundFavoritesStore } = await import('./soundFavoritesStore')
    await useSoundFavoritesStore.getState().load()

    expect(useSoundFavoritesStore.getState().favorites.map((f) => f.id)).toEqual(['a1'])
    // Os outros ajustes ficam; só os favoritos saem do localStorage.
    expect(JSON.parse(localStorage.getItem(PREFS) ?? '{}')).toEqual({
      volume: 0.5,
      keybinds: { a1: 'F1' }
    })

    api.calls = []
    await useSoundFavoritesStore.getState().load()
    expect(api.calls).toEqual(['list'])
  })

  it('som apagado na origem sai da lista', async () => {
    api.server = ['a1', 'a2']
    const { useSoundFavoritesStore } = await import('./soundFavoritesStore')
    await useSoundFavoritesStore.getState().load()
    useSoundFavoritesStore.getState().forget('a1')
    expect(useSoundFavoritesStore.getState().favorites.map((f) => f.id)).toEqual(['a2'])
  })
})
