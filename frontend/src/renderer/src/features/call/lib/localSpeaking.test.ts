import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MicHandle, SpeakingTap } from './noiseSuppression'

// ─── Fallback: AudioContext único (sem o RNNoise) ───────────────────────────

class FakeNode {
  static instances: FakeNode[] = []
  port = { onmessage: null as ((e: { data: boolean }) => void) | null, close: vi.fn() }
  connect = vi.fn((next: unknown) => next)
  disconnect = vi.fn()
  constructor() {
    FakeNode.instances.push(this)
  }
}

class FakeContext {
  static instances: FakeContext[] = []
  state: 'running' | 'suspended' = 'running'
  destination = {}
  audioWorklet = { addModule: vi.fn(async () => {}) }
  resume = vi.fn(async () => {
    this.state = 'running'
  })
  suspend = vi.fn(async () => {
    this.state = 'suspended'
  })
  close = vi.fn(async () => {})
  createMediaStreamSource = vi.fn(() => new FakeNode())
  constructor() {
    FakeContext.instances.push(this)
  }
}

vi.stubGlobal('AudioContext', FakeContext)
vi.stubGlobal('AudioWorkletNode', FakeNode)
vi.stubGlobal(
  'MediaStream',
  class {
    constructor(public tracks: unknown[]) {}
  }
)

const { watchLocalSpeaking } = await import('./localSpeaking')

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

/** Microfone sem RNNoise (fallback do Chromium): só o stream. */
function plainMic(): MicHandle {
  const track = { id: 'mic' }
  return {
    stream: { getAudioTracks: () => [track] } as unknown as MediaStream,
    setNoiseSuppression: () => {},
    stop: () => {}
  }
}

function handlers(): {
  changes: boolean[]
  unavailable: ReturnType<typeof vi.fn>
  onChange: (s: boolean) => void
  onUnavailable: () => void
} {
  const changes: boolean[] = []
  const unavailable = vi.fn()
  return { changes, unavailable, onChange: (s) => changes.push(s), onUnavailable: unavailable }
}

describe('watchLocalSpeaking — no contexto do microfone (RNNoise)', () => {
  it('usa o watchSpeaking do microfone e não abre AudioContext', async () => {
    const before = FakeContext.instances.length
    let emit: (s: boolean) => void = () => {}
    const tap: SpeakingTap = { ready: Promise.resolve(), stop: vi.fn() }
    const mic: MicHandle = {
      ...plainMic(),
      watchSpeaking: (onChange) => {
        emit = onChange
        return tap
      }
    }
    const h = handlers()
    const stop = watchLocalSpeaking(mic, h)
    await flush()
    emit(true)
    stop()
    emit(false)

    expect(FakeContext.instances.length).toBe(before)
    expect(h.changes).toEqual([true])
    expect(tap.stop).toHaveBeenCalledTimes(1)
    expect(h.unavailable).not.toHaveBeenCalled()
  })

  it('worklet que não carrega: avisa para voltar ao servidor', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const tap: SpeakingTap = { ready: Promise.reject(new Error('CSP')), stop: vi.fn() }
    const h = handlers()
    watchLocalSpeaking({ ...plainMic(), watchSpeaking: () => tap }, h)
    await flush()
    expect(h.unavailable).toHaveBeenCalledTimes(1)
    expect(tap.stop).toHaveBeenCalled()
  })
})

describe('watchLocalSpeaking — fallback com um AudioContext só', () => {
  beforeEach(() => {
    FakeNode.instances.length = 0
  })

  it('reaproveita o mesmo contexto entre chamadas e o suspende fora delas', async () => {
    const h = handlers()
    const stopA = watchLocalSpeaking(plainMic(), h)
    await flush()
    expect(FakeContext.instances).toHaveLength(1)
    const ctx = FakeContext.instances[0]

    // Troca de microfone: o novo começa antes de o antigo parar.
    const stopB = watchLocalSpeaking(plainMic(), h)
    await flush()
    stopA()
    expect(ctx.suspend).not.toHaveBeenCalled()

    stopB()
    expect(ctx.suspend).toHaveBeenCalledTimes(1)
    expect(ctx.close).not.toHaveBeenCalled()

    // Próxima chamada: mesmo contexto, acordado de novo; módulo carregado uma vez.
    const stopC = watchLocalSpeaking(plainMic(), h)
    await flush()
    expect(FakeContext.instances).toHaveLength(1)
    expect(ctx.resume).toHaveBeenCalled()
    expect(ctx.audioWorklet.addModule).toHaveBeenCalledTimes(1)
    stopC()
  })

  it('repassa as mudanças e para de ouvir ao parar', async () => {
    const h = handlers()
    const stop = watchLocalSpeaking(plainMic(), h)
    await flush()
    const node = FakeNode.instances.find((n) => n.port.onmessage)!
    node.port.onmessage!({ data: true })
    stop()
    expect(h.changes).toEqual([true])
    expect(node.disconnect).toHaveBeenCalled()
    expect(node.port.close).toHaveBeenCalled()
    expect(node.port.onmessage).toBeNull()
  })

  it('contexto que não sai de suspenso: volta ao servidor depois de 2 s', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const ctx = FakeContext.instances[0]
    ctx.state = 'suspended'
    ctx.resume.mockImplementationOnce(() => new Promise(() => {}))
    const h = handlers()
    watchLocalSpeaking(plainMic(), h)
    await vi.advanceTimersByTimeAsync(1_999)
    expect(h.unavailable).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(h.unavailable).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('microfone sem track de áudio: volta ao servidor', () => {
    const h = handlers()
    const mic = { ...plainMic(), stream: { getAudioTracks: () => [] } as unknown as MediaStream }
    watchLocalSpeaking(mic, h)
    expect(h.unavailable).toHaveBeenCalledTimes(1)
  })
})
