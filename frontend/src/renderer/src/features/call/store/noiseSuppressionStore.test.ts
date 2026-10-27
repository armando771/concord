import { beforeEach, describe, expect, it, vi } from 'vitest'

const KEY = 'concord-noise-suppression'

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

let storage: Storage

beforeEach(() => {
  // O persist padrão do zustand lê window.localStorage.
  storage = memoryStorage()
  vi.stubGlobal('window', { localStorage: storage })
  vi.resetModules()
})

const load = async (): Promise<typeof import('./noiseSuppressionStore')> =>
  import('./noiseSuppressionStore')

describe('noiseSuppressionStore', () => {
  it('começa desligada', async () => {
    const { useNoiseSuppressionStore } = await load()
    expect(useNoiseSuppressionStore.getState().enabled).toBe(false)
  })

  it('a escolha de ligar fica salva para as próximas vezes', async () => {
    const first = await load()
    first.useNoiseSuppressionStore.getState().setEnabled(true)
    vi.resetModules()
    const second = await load()
    expect(second.useNoiseSuppressionStore.getState().enabled).toBe(true)
  })

  it('a escolha de desligar também fica salva', async () => {
    storage.setItem(KEY, JSON.stringify({ state: { enabled: true }, version: 1 }))
    const first = await load()
    first.useNoiseSuppressionStore.getState().setEnabled(false)
    vi.resetModules()
    const second = await load()
    expect(second.useNoiseSuppressionStore.getState().enabled).toBe(false)
  })

  it('estado salvo antes da migração (versão 0, quase sempre o padrão antigo) vira desligado', async () => {
    storage.setItem(KEY, JSON.stringify({ state: { enabled: true }, version: 0 }))
    const { useNoiseSuppressionStore } = await load()
    expect(useNoiseSuppressionStore.getState().enabled).toBe(false)
    expect(JSON.parse(storage.getItem(KEY)!)).toMatchObject({ state: { enabled: false }, version: 1 })
  })

  it('sem escolha, abrir o app não grava nada (o padrão não fica salvo como escolha)', async () => {
    await load()
    expect(storage.getItem(KEY)).toBeNull()
  })
})

describe('rnnoiseStatusStore', () => {
  it('marcar o RNNoise como (in)disponível não grava a preferência da supressão', async () => {
    const { useRnnoiseStatusStore } = await import('./rnnoiseStatusStore')
    await load()
    useRnnoiseStatusStore.getState().setAvailable(false)
    useRnnoiseStatusStore.getState().setAvailable(true)
    expect(useRnnoiseStatusStore.getState().available).toBe(true)
    expect(storage.getItem(KEY)).toBeNull()
  })
})
