import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_CUSTOM_BACKGROUNDS } from '../lib/videoBackground'

// IndexedDB falso: o store só enxerga a interface de lib/gifStorage.
const gifs = vi.hoisted(() => ({
  data: new Map<string, Blob>(),
  failPut: false,
  put: vi.fn(async (id: string, blob: Blob) => {
    if (gifs.failPut) throw new Error('quota')
    gifs.data.set(id, blob)
  }),
  get: vi.fn(async (id: string) => gifs.data.get(id) ?? null),
  delete: vi.fn(async (id: string) => {
    gifs.data.delete(id)
  })
}))
vi.mock('../lib/gifStorage', () => ({ gifStorage: gifs }))

const gifBlob = (name = 'g'): Blob => ({ name, size: 10, type: 'image/gif' }) as unknown as Blob
const urls: string[] = []

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

async function load(): Promise<typeof import('./videoSettingsStore').useVideoSettingsStore> {
  vi.resetModules()
  return (await import('./videoSettingsStore')).useVideoSettingsStore
}

const jpeg = (n: number): string => `data:image/jpeg;base64,${n}`

describe('videoSettingsStore', () => {
  beforeEach(() => {
    stubStorage(memoryStorage())
    gifs.data.clear()
    gifs.failPut = false
    gifs.put.mockClear()
    gifs.get.mockClear()
    gifs.delete.mockClear()
    urls.length = 0
    let n = 0
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => {
        const u = `blob:test/${n++}`
        urls.push(u)
        return u
      }),
      revokeObjectURL: vi.fn()
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('começa sem efeito, câmera padrão e sem prévia obrigatória', async () => {
    const s = (await load()).getState()
    expect(s).toMatchObject({ cameraId: '', alwaysPreview: false, customs: [] })
    expect(s.background).toEqual({ mode: 'none', image: null })
  })

  it('persiste as alterações (sem as funções)', async () => {
    const storage = memoryStorage()
    stubStorage(storage)
    const store = await load()
    store.getState().setCameraId('cam-2')
    store.getState().setAlwaysPreview(true)
    store.getState().setBackground({ mode: 'blur', image: null })
    const saved = JSON.parse(storage.data['concord-video']).state
    expect(saved).toMatchObject({
      cameraId: 'cam-2',
      alwaysPreview: true,
      background: { mode: 'blur' }
    })
    expect(saved.setCameraId).toBeUndefined()
  })

  it('restaura o que estava salvo', async () => {
    stubStorage(
      memoryStorage({
        'concord-video': JSON.stringify({
          state: { cameraId: 'cam-9', alwaysPreview: true, background: { mode: 'blur' } },
          version: 0
        })
      })
    )
    expect((await load()).getState()).toMatchObject({
      cameraId: 'cam-9',
      alwaysPreview: true,
      background: { mode: 'blur' }
    })
  })

  it('storage corrompido volta ao padrão', async () => {
    stubStorage(
      memoryStorage({
        'concord-video': JSON.stringify({
          state: { cameraId: 5, alwaysPreview: 'sim', background: { mode: 'roxo' }, customs: 'x' },
          version: 0
        })
      })
    )
    const s = (await load()).getState()
    expect(s).toMatchObject({ cameraId: '', alwaysPreview: false, customs: [] })
    expect(s.background.mode).toBe('none')
  })

  it('imagem salva escolhida que sumiu volta para "nenhum"', async () => {
    stubStorage(
      memoryStorage({
        'concord-video': JSON.stringify({
          state: { background: { mode: 'image', image: { kind: 'custom', id: 'x' } }, customs: [] },
          version: 0
        })
      })
    )
    expect((await load()).getState().background.mode).toBe('none')
  })

  it('apaga a chave antiga do chroma key', async () => {
    const storage = memoryStorage({ 'concord-chroma-key': '{"state":{"enabled":true}}' })
    stubStorage(storage)
    await load()
    expect(storage.data['concord-chroma-key']).toBeUndefined()
  })

  it('quota estourada não derruba a troca de configuração', async () => {
    const storage = memoryStorage()
    storage.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    stubStorage(storage)
    const store = await load()
    expect(() => store.getState().setBackground({ mode: 'blur', image: null })).not.toThrow()
    expect(store.getState().background.mode).toBe('blur')
  })

  it('só aceita desfoque/imagem válidos', async () => {
    const store = await load()
    store.getState().setBackground({ mode: 'image', image: null })
    expect(store.getState().background.mode).toBe('none')
    store.getState().setBackground({ mode: 'image', image: { kind: 'preset', id: 'aurora' } })
    expect(store.getState().background).toEqual({
      mode: 'image',
      image: { kind: 'preset', id: 'aurora' }
    })
  })

  describe('GIFs de fundo', () => {
    it('guarda o arquivo no IndexedDB, escolhe o GIF e usa um blob: da sessão', async () => {
      const store = await load()
      const blob = gifBlob()
      const id = await store.getState().addCustomGif(blob)
      expect(gifs.put).toHaveBeenCalledWith(id, blob)
      expect(store.getState().customs).toEqual([{ id, dataUrl: urls[0], animated: true, blob }])
      expect(store.getState().background).toEqual({ mode: 'image', image: { kind: 'custom', id } })
    })

    it('sem escolher: guarda e mantém o fundo atual', async () => {
      const store = await load()
      store.getState().setBackground({ mode: 'blur', image: null })
      await store.getState().addCustomGif(gifBlob(), false)
      expect(store.getState().background.mode).toBe('blur')
      expect(store.getState().customs).toHaveLength(1)
    })

    it('o localStorage guarda só o registro (nunca o blob: nem o arquivo)', async () => {
      const storage = memoryStorage()
      stubStorage(storage)
      const store = await load()
      const id = await store.getState().addCustomGif(gifBlob())
      const saved = JSON.parse(storage.data['concord-video']).state
      expect(saved.customs).toEqual([{ id, dataUrl: '', animated: true }])
    })

    it('não deu para guardar o arquivo: rejeita e nada muda', async () => {
      const store = await load()
      gifs.failPut = true
      await expect(store.getState().addCustomGif(gifBlob())).rejects.toThrow()
      expect(store.getState().customs).toEqual([])
      expect(store.getState().background.mode).toBe('none')
    })

    it('remover apaga o arquivo do IndexedDB e solta o blob:', async () => {
      const store = await load()
      const id = await store.getState().addCustomGif(gifBlob())
      store.getState().removeCustom(id)
      expect(gifs.delete).toHaveBeenCalledWith(id)
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(urls[0])
      expect(store.getState().background.mode).toBe('none')
    })

    it('passou do limite: o GIF mais antigo sai do banco também', async () => {
      const store = await load()
      const first = await store.getState().addCustomGif(gifBlob('0'))
      for (let i = 1; i <= MAX_CUSTOM_BACKGROUNDS; i++) store.getState().addCustom(jpeg(i))
      expect(store.getState().customs.some((c) => c.id === first)).toBe(false)
      expect(gifs.delete).toHaveBeenCalledWith(first)
    })

    it('ao abrir o app, busca os GIFs salvos no IndexedDB e dá um blob: a cada um', async () => {
      gifs.data.set('g1', gifBlob())
      vi.stubGlobal('indexedDB', {})
      stubStorage(
        memoryStorage({
          'concord-video': JSON.stringify({
            state: {
              background: { mode: 'image', image: { kind: 'custom', id: 'g1' } },
              customs: [{ id: 'g1', dataUrl: '', animated: true }]
            },
            version: 0
          })
        })
      )
      const store = await load()
      await vi.waitFor(() => expect(store.getState().customs[0].dataUrl).toBe(urls[0]))
      expect(store.getState().background.mode).toBe('image')
    })

    it('GIF que sumiu do banco sai da lista e o fundo escolhido volta para "nenhum"', async () => {
      vi.stubGlobal('indexedDB', {})
      stubStorage(
        memoryStorage({
          'concord-video': JSON.stringify({
            state: {
              background: { mode: 'image', image: { kind: 'custom', id: 'g1' } },
              customs: [
                { id: 'g1', dataUrl: '', animated: true },
                { id: 'i1', dataUrl: jpeg(1) }
              ]
            },
            version: 0
          })
        })
      )
      const store = await load()
      await vi.waitFor(() => expect(store.getState().customs.map((c) => c.id)).toEqual(['i1']))
      expect(store.getState().background).toEqual({ mode: 'none', image: null })
    })
  })

  describe('imagens salvas', () => {
    it('adicionar guarda, escolhe e devolve o id', async () => {
      const store = await load()
      const id = store.getState().addCustom(jpeg(1))
      expect(store.getState().customs).toEqual([{ id, dataUrl: jpeg(1) }])
      expect(store.getState().background).toEqual({ mode: 'image', image: { kind: 'custom', id } })
    })

    it('sem escolher: guarda a imagem e mantém o fundo atual', async () => {
      const store = await load()
      store.getState().setBackground({ mode: 'blur', image: null })
      const id = store.getState().addCustom(jpeg(1), false)
      expect(store.getState().customs).toEqual([{ id, dataUrl: jpeg(1) }])
      expect(store.getState().background.mode).toBe('blur')
    })

    it('a mesma imagem não duplica', async () => {
      const store = await load()
      const a = store.getState().addCustom(jpeg(1))
      const b = store.getState().addCustom(jpeg(1))
      expect(b).toBe(a)
      expect(store.getState().customs).toHaveLength(1)
    })

    it('passou do limite: a mais antiga sai', async () => {
      const store = await load()
      const first = store.getState().addCustom(jpeg(0))
      for (let i = 1; i <= MAX_CUSTOM_BACKGROUNDS; i++) store.getState().addCustom(jpeg(i))
      const customs = store.getState().customs
      expect(customs).toHaveLength(MAX_CUSTOM_BACKGROUNDS)
      expect(customs.some((c) => c.id === first)).toBe(false)
      expect(customs[0].dataUrl).toBe(jpeg(MAX_CUSTOM_BACKGROUNDS))
    })

    it('remover a que está em uso volta para "nenhum"; outra não mexe na escolha', async () => {
      const store = await load()
      const a = store.getState().addCustom(jpeg(1))
      const b = store.getState().addCustom(jpeg(2))
      store.getState().removeCustom(a)
      expect(store.getState().background.image?.id).toBe(b)
      store.getState().removeCustom(b)
      expect(store.getState().background).toEqual({ mode: 'none', image: null })
      expect(store.getState().customs).toEqual([])
    })
  })
})
