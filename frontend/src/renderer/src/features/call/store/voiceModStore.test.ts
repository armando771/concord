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
  // O persist padrão do zustand lê window.localStorage.
  vi.stubGlobal('window', { localStorage: memoryStorage() })
  vi.resetModules()
})

describe('voiceModStore', () => {
  it('começa em Normal, sem personalização, disponível e sem monitor', async () => {
    const { useVoiceModStore } = await import('./voiceModStore')
    expect(useVoiceModStore.getState()).toMatchObject({
      preset: 'normal',
      customized: false,
      pitch: 0,
      timbre: 0,
      intensity: 1,
      available: true,
      monitoring: false
    })
  })

  it('escolher um preset preenche os sliders e zera a personalização', async () => {
    const { useVoiceModStore } = await import('./voiceModStore')
    useVoiceModStore.getState().selectPreset('grave')
    expect(useVoiceModStore.getState()).toMatchObject({
      preset: 'grave',
      customized: false,
      pitch: -5,
      timbre: -0.5,
      intensity: 1
    })
  })

  it('mexer num slider marca como personalizado e mantém o preset', async () => {
    const { useVoiceModStore } = await import('./voiceModStore')
    const store = useVoiceModStore.getState()
    store.selectPreset('robo')
    store.setPitch(4)
    expect(useVoiceModStore.getState()).toMatchObject({
      preset: 'robo',
      customized: true,
      pitch: 4
    })
  })

  it('os sliders respeitam os limites', async () => {
    const { useVoiceModStore } = await import('./voiceModStore')
    const store = useVoiceModStore.getState()
    store.setPitch(99)
    store.setTimbre(-9)
    store.setIntensity(5)
    expect(useVoiceModStore.getState()).toMatchObject({ pitch: 12, timbre: -1, intensity: 1 })
  })

  it('persiste a escolha, mas não available nem monitoring', async () => {
    const first = await import('./voiceModStore')
    first.useVoiceModStore.getState().selectPreset('eco')
    first.useVoiceModStore.getState().setMonitoring(true)
    first.useVoiceModStore.getState().setAvailable(false)
    const saved = JSON.parse(window.localStorage.getItem('concord-voice-mod') ?? '{}')
    expect(saved.state).toMatchObject({ preset: 'eco', intensity: 0.6 })
    expect(saved.state).not.toHaveProperty('monitoring')
    expect(saved.state).not.toHaveProperty('available')
  })
})
