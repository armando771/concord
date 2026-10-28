import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const route = { setVolume: vi.fn(), stop: vi.fn() }
vi.mock('../../call/lib/voiceOutput', () => ({ routeElementToOutput: vi.fn(() => route) }))

import { routeElementToOutput } from '../../call/lib/voiceOutput'
import { playWav } from './wavPlayer'

class FakeAudio {
  static last: FakeAudio
  static playResult: Promise<void> = Promise.resolve()
  src = ''
  pause = vi.fn()
  private handlers: Record<string, () => void> = {}
  constructor() {
    FakeAudio.last = this
  }
  addEventListener(type: string, fn: () => void): void {
    this.handlers[type] = fn
  }
  fire(type: string): void {
    this.handlers[type]?.()
  }
  play(): Promise<void> {
    return FakeAudio.playResult
  }
}

const wav = new Uint8Array([82, 73, 70, 70])

describe('playWav', () => {
  beforeEach(() => {
    vi.stubGlobal('Audio', FakeAudio)
    FakeAudio.playResult = Promise.resolve()
    route.stop.mockClear()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fala')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('toca o WAV pela saída das vozes (dispositivo escolhido e volume de saída)', () => {
    playWav(wav, () => {})
    expect(FakeAudio.last.src).toBe('blob:fala')
    // volume local 100%: o volume de saída (até 150%) entra no routeElementToOutput
    expect(routeElementToOutput).toHaveBeenCalledWith(FakeAudio.last, 1)
  })

  it('acabou: avisa a fila e solta a saída e o blob', () => {
    const onEnd = vi.fn()
    playWav(wav, onEnd)
    FakeAudio.last.fire('ended')
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(route.stop).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fala')
  })

  it('play recusado ou erro do áudio: solta a fila', async () => {
    FakeAudio.playResult = Promise.reject(new Error('não deixou'))
    const onEnd = vi.fn()
    playWav(wav, onEnd)
    await vi.waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1))
    FakeAudio.last.fire('error')
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('parar (fila limpa) corta o áudio sem avisar o fim', () => {
    const onEnd = vi.fn()
    const stop = playWav(wav, onEnd)
    stop()
    expect(FakeAudio.last.pause).toHaveBeenCalled()
    expect(route.stop).toHaveBeenCalledTimes(1)
    FakeAudio.last.fire('ended')
    expect(onEnd).not.toHaveBeenCalled()
  })
})
