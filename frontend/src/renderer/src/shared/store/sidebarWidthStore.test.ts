import { beforeEach, describe, expect, it, vi } from 'vitest'

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

beforeEach(() => {
  globalThis.localStorage = memoryStorage()
  vi.resetModules()
})

describe('sidebarWidthStore', () => {
  it('começa no padrão e lembra a largura escolhida', async () => {
    const { useSidebarWidthStore } = await import('./sidebarWidthStore')
    expect(useSidebarWidthStore.getState().preferred).toEqual({ channels: 240, members: 256 })
    useSidebarWidthStore.getState().setPreferred('channels', 333)
    expect(localStorage.getItem('concord:sidebar-width:channels')).toBe('333')

    vi.resetModules()
    const again = await import('./sidebarWidthStore')
    expect(again.useSidebarWidthStore.getState().preferred.channels).toBe(333)
  })

  it('fora dos limites é limitado; duplo clique volta ao padrão', async () => {
    const { useSidebarWidthStore } = await import('./sidebarWidthStore')
    useSidebarWidthStore.getState().setPreferred('members', 9999)
    expect(useSidebarWidthStore.getState().preferred.members).toBe(400)
    useSidebarWidthStore.getState().resetPreferred('members')
    expect(useSidebarWidthStore.getState().preferred.members).toBe(256)
    expect(localStorage.getItem('concord:sidebar-width:members')).toBeNull()
  })

  it('janela menor encolhe a largura de fato, mas não a preferência', async () => {
    const { useSidebarWidthStore, selectSidebarWidth } = await import('./sidebarWidthStore')
    const s = useSidebarWidthStore.getState()
    s.setPreferred('channels', 400)
    s.setMounted('channels', true)
    s.setViewport(700)
    const state = useSidebarWidthStore.getState()
    expect(selectSidebarWidth('channels')(state)).toBe(268)
    expect(state.preferred.channels).toBe(400)
    expect(localStorage.getItem('concord:sidebar-width:channels')).toBe('400')
  })

  it('sem localStorage, funciona com o padrão', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
      removeItem: () => {
        throw new Error('bloqueado')
      }
    })
    const { useSidebarWidthStore } = await import('./sidebarWidthStore')
    expect(useSidebarWidthStore.getState().preferred.channels).toBe(240)
    useSidebarWidthStore.getState().setPreferred('channels', 300)
    expect(useSidebarWidthStore.getState().preferred.channels).toBe(300)
    vi.unstubAllGlobals()
  })
})
