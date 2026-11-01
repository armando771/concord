import { beforeEach, describe, expect, it, vi } from 'vitest'

// AudioContext simulado: só o que o voiceOutput usa.

function fakeGain(): {
  gain: { value: number; setTargetAtTime: ReturnType<typeof vi.fn> }
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
} {
  const node = {
    gain: {
      value: 1,
      setTargetAtTime: vi.fn((v: number) => {
        node.gain.value = v
      })
    },
    connect: vi.fn((next: unknown) => next),
    disconnect: vi.fn()
  }
  return node
}

function fakeSource(): { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> } {
  return { connect: vi.fn((next: unknown) => next), disconnect: vi.fn() }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  state = 'running'
  currentTime = 0
  destination = {}
  gains: ReturnType<typeof fakeGain>[] = []
  setSinkId = vi.fn<(id: string) => Promise<void>>(async () => {})
  resume = vi.fn(async () => {})
  createMediaStreamSource = vi.fn<(stream: MediaStream) => ReturnType<typeof fakeSource>>(() =>
    fakeSource()
  )
  createMediaElementSource = vi.fn<(el: HTMLMediaElement) => ReturnType<typeof fakeSource>>(() =>
    fakeSource()
  )
  constructor() {
    FakeAudioContext.instances.push(this)
  }
  createGain = (): ReturnType<typeof fakeGain> => {
    const g = fakeGain()
    this.gains.push(g)
    return g
  }
}

vi.stubGlobal('AudioContext', FakeAudioContext)

const stream = {} as MediaStream

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
  vi.stubGlobal('window', { localStorage: memoryStorage() })
  FakeAudioContext.instances.length = 0
  vi.resetModules()
})

async function load(outputVolume = 1): Promise<{
  routeStreamToOutput: typeof import('./voiceOutput').routeStreamToOutput
  routeElementToOutput: typeof import('./voiceOutput').routeElementToOutput
  setVoiceOutputDevice: typeof import('./voiceOutput').setVoiceOutputDevice
  store: typeof import('../store/voiceAudioStore').useVoiceAudioStore
}> {
  const store = (await import('../store/voiceAudioStore')).useVoiceAudioStore
  store.setState({ outputVolume })
  const output = await import('./voiceOutput')
  return { ...output, store }
}

describe('voiceOutput — ganho das rotas', () => {
  it('o ganho é o volume local × o volume de saída', async () => {
    const { routeStreamToOutput } = await load(1.5)
    routeStreamToOutput(stream, 0.5)
    expect(FakeAudioContext.instances[0].gains[0].gain.value).toBeCloseTo(0.75)
  })

  it('volume de saída muda as rotas que já estão tocando', async () => {
    const { routeStreamToOutput, store } = await load(1)
    routeStreamToOutput(stream, 1)
    const gain = FakeAudioContext.instances[0].gains[0]
    store.getState().setOutputVolume(0.5)
    expect(gain.gain.value).toBeCloseTo(0.5)
  })

  it('o volume local da rota (pessoa ou clipe) continua valendo por cima da saída geral', async () => {
    const { routeStreamToOutput, store } = await load(1.5)
    const route = routeStreamToOutput(stream, 1)
    const gain = FakeAudioContext.instances[0].gains[0]
    route.setVolume(0.2)
    expect(gain.gain.value).toBeCloseTo(0.3)
    store.getState().setOutputVolume(1)
    expect(gain.gain.value).toBeCloseTo(0.2)
  })

  it('não mexe mais numa rota depois de parada', async () => {
    const { routeStreamToOutput, store } = await load(1)
    const route = routeStreamToOutput(stream, 1)
    const gain = FakeAudioContext.instances[0].gains[0]
    route.stop()
    expect(gain.disconnect).toHaveBeenCalled()
    gain.gain.setTargetAtTime.mockClear()
    store.getState().setOutputVolume(0.5)
    expect(gain.gain.setTargetAtTime).not.toHaveBeenCalled()
  })
})

describe('voiceOutput — fontes e contexto', () => {
  it('fluxos e clipes usam o mesmo contexto', async () => {
    const { routeStreamToOutput, routeElementToOutput } = await load()
    routeStreamToOutput(stream, 1)
    routeElementToOutput({} as HTMLMediaElement, 1)
    expect(FakeAudioContext.instances).toHaveLength(1)
    expect(FakeAudioContext.instances[0].createMediaStreamSource).toHaveBeenCalledWith(stream)
    expect(FakeAudioContext.instances[0].createMediaElementSource).toHaveBeenCalled()
  })

  it('o dispositivo escolhido vale antes e depois de o contexto existir', async () => {
    const { routeStreamToOutput, setVoiceOutputDevice } = await load()
    setVoiceOutputDevice('fone')
    routeStreamToOutput(stream, 1)
    expect(FakeAudioContext.instances[0].setSinkId).toHaveBeenCalledWith('fone')
    setVoiceOutputDevice('usb')
    expect(FakeAudioContext.instances[0].setSinkId).toHaveBeenLastCalledWith('usb')
  })
})
