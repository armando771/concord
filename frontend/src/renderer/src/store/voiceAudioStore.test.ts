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

describe('voiceAudioStore', () => {
  it('começa com volumes em 100%, detecção ligada e sensibilidade 60 (−40 dB)', async () => {
    const { useVoiceAudioStore } = await import('./voiceAudioStore')
    expect(useVoiceAudioStore.getState()).toMatchObject({
      inputVolume: 1,
      outputVolume: 1,
      detectionEnabled: true,
      sensitivity: 60
    })
  })

  it('volumes ficam entre 0 e 150%', async () => {
    const { useVoiceAudioStore } = await import('./voiceAudioStore')
    const { setInputVolume, setOutputVolume } = useVoiceAudioStore.getState()
    setInputVolume(2)
    setOutputVolume(-1)
    expect(useVoiceAudioStore.getState()).toMatchObject({ inputVolume: 1.5, outputVolume: 0 })
  })

  it('sensibilidade fica entre 0 e 100', async () => {
    const { useVoiceAudioStore } = await import('./voiceAudioStore')
    useVoiceAudioStore.getState().setSensitivity(140)
    expect(useVoiceAudioStore.getState().sensitivity).toBe(100)
    useVoiceAudioStore.getState().setSensitivity(-3)
    expect(useVoiceAudioStore.getState().sensitivity).toBe(0)
  })

  it('persiste as configurações e volta com elas depois de recarregar', async () => {
    const first = await import('./voiceAudioStore')
    first.useVoiceAudioStore.getState().setInputVolume(1.2)
    first.useVoiceAudioStore.getState().setOutputVolume(0.4)
    first.useVoiceAudioStore.getState().setDetectionEnabled(false)
    first.useVoiceAudioStore.getState().setSensitivity(20)

    vi.resetModules()
    const second = await import('./voiceAudioStore')
    expect(second.useVoiceAudioStore.getState()).toMatchObject({
      inputVolume: 1.2,
      outputVolume: 0.4,
      detectionEnabled: false,
      sensitivity: 20
    })
  })
})
