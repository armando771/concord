import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MemStorage {
  data: Record<string, string>
  getItem: (k: string) => string | null
  setItem: ReturnType<typeof vi.fn>
  removeItem: (k: string) => void
}

function memoryStorage(initial: Record<string, string> = {}): MemStorage {
  const data = { ...initial }
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: vi.fn((k: string, v: string) => {
      data[k] = v
    }),
    removeItem: (k: string) => {
      delete data[k]
    }
  }
}

// O persist do zustand lê window.localStorage (no node não há window).
function stubStorage(storage: MemStorage): void {
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('window', { localStorage: storage })
}

async function load(): Promise<typeof import('./chromaKeyStore').useChromaKeyStore> {
  vi.resetModules()
  return (await import('./chromaKeyStore')).useChromaKeyStore
}

describe('chromaKeyStore', () => {
  beforeEach(() => stubStorage(memoryStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it('começa desligado, com o padrão', async () => {
    const s = (await load()).getState()
    expect(s.enabled).toBe(false)
    expect(s.keyColor).toBe('#00b140')
    expect(s.background.mode).toBe('color')
  })

  it('persiste as alterações', async () => {
    const storage = memoryStorage()
    stubStorage(storage)
    const store = await load()
    store.getState().setEnabled(true)
    store.getState().setKeyColor('#0047bb')
    store.getState().setSimilarity(0.7)
    const saved = JSON.parse(storage.data['concord-chroma-key']).state
    expect(saved).toMatchObject({ enabled: true, keyColor: '#0047bb', similarity: 0.7 })
    expect(saved.setEnabled).toBeUndefined()
  })

  it('restaura o que estava salvo', async () => {
    stubStorage(
      memoryStorage({
        'concord-chroma-key': JSON.stringify({
          state: { enabled: true, keyColor: '#0047bb', similarity: 0.2 },
          version: 0
        })
      })
    )
    const s = (await load()).getState()
    expect(s).toMatchObject({ enabled: true, keyColor: '#0047bb', similarity: 0.2 })
  })

  it('storage corrompido volta ao padrão', async () => {
    stubStorage(
      memoryStorage({
        'concord-chroma-key': JSON.stringify({
          state: { enabled: 'sim', keyColor: 'xyz', similarity: 99 },
          version: 0
        })
      })
    )
    const s = (await load()).getState()
    expect(s.enabled).toBe(false)
    expect(s.keyColor).toBe('#00b140')
    expect(s.similarity).toBe(1)
  })

  it('quota estourada não derruba a troca de configuração', async () => {
    const storage = memoryStorage()
    storage.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    stubStorage(storage)
    const store = await load()
    expect(() => store.getState().setSimilarity(0.5)).not.toThrow()
    expect(store.getState().similarity).toBe(0.5)
  })

  it('imagem de fundo inválida é descartada', async () => {
    const store = await load()
    store.getState().setBackground({ mode: 'image', image: 'http://x/y.png' })
    expect(store.getState().background).toMatchObject({ mode: 'color', image: '' })
    store.getState().setBackground({ mode: 'image', image: 'data:image/jpeg;base64,AAA' })
    expect(store.getState().background.mode).toBe('image')
  })
})
