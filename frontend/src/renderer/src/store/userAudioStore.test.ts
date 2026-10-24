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

describe('userAudioStore', () => {
  it('sem ajuste, todo mundo está em 100% e com som', async () => {
    const { useUserAudioStore, outputVolume } = await import('./userAudioStore')
    expect(useUserAudioStore.getState().get('ana')).toEqual({ volume: 1, muted: false })
    expect(outputVolume(useUserAudioStore.getState().get('ana'))).toBe(1)
  })

  it('ajusta o volume de uma pessoa (0–100%)', async () => {
    const { useUserAudioStore } = await import('./userAudioStore')
    useUserAudioStore.getState().setVolume('ana', 0.4)
    useUserAudioStore.getState().setVolume('bia', 7)
    expect(useUserAudioStore.getState().get('ana').volume).toBe(0.4)
    expect(useUserAudioStore.getState().get('bia').volume).toBe(1)
  })

  it('silenciar só para mim zera o som dela, sem perder o volume escolhido', async () => {
    const { useUserAudioStore, outputVolume } = await import('./userAudioStore')
    useUserAudioStore.getState().setVolume('ana', 0.6)
    useUserAudioStore.getState().toggleMuted('ana')
    expect(outputVolume(useUserAudioStore.getState().get('ana'))).toBe(0)
    useUserAudioStore.getState().toggleMuted('ana')
    expect(outputVolume(useUserAudioStore.getState().get('ana'))).toBe(0.6)
  })

  it('lembra os ajustes ao abrir o app de novo', async () => {
    const first = await import('./userAudioStore')
    first.useUserAudioStore.getState().setVolume('ana', 0.3)
    first.useUserAudioStore.getState().toggleMuted('bia')

    vi.resetModules()
    const second = await import('./userAudioStore')
    expect(second.useUserAudioStore.getState().get('ana')).toEqual({ volume: 0.3, muted: false })
    expect(second.useUserAudioStore.getState().get('bia').muted).toBe(true)
  })

  it('volume da live é separado da voz da mesma pessoa e de outras lives', async () => {
    const { useUserAudioStore, outputVolume, streamAudioKey } = await import('./userAudioStore')
    const store = useUserAudioStore.getState()
    store.setVolume(streamAudioKey('ana'), 0.2)
    store.toggleMuted(streamAudioKey('bia'))

    const state = useUserAudioStore.getState()
    expect(outputVolume(state.get(streamAudioKey('ana')))).toBe(0.2)
    expect(outputVolume(state.get('ana'))).toBe(1) // a voz da Ana não muda
    expect(outputVolume(state.get(streamAudioKey('bia')))).toBe(0)
    expect(outputVolume(state.get('bia'))).toBe(1)
  })
})
