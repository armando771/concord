import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const route = { setVolume: vi.fn(), stop: vi.fn() }
vi.mock('./voiceOutput', () => ({ routeElementToOutput: vi.fn(() => route) }))

import { routeElementToOutput } from './voiceOutput'
import { MAX_ENTRANCE_CLIP_MS, playEntranceClip } from './entranceSoundPlayer'

/** <audio> de mentira: o teste decide se o play() dá certo e dispara eventos. */
class FakeAudio {
  static last: FakeAudio
  static playResult: Promise<void> = Promise.resolve()
  src = ''
  crossOrigin: string | null = null
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

describe('playEntranceClip', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('Audio', FakeAudio)
    FakeAudio.playResult = Promise.resolve()
    route.stop.mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('toca pela saída das vozes, no volume pedido, com CORS anônimo', async () => {
    await expect(playEntranceClip('/api/entrance-sounds/x', 0.4)).resolves.toBe(true)
    expect(FakeAudio.last.src).toBe('/api/entrance-sounds/x')
    expect(FakeAudio.last.crossOrigin).toBe('anonymous')
    expect(routeElementToOutput).toHaveBeenCalledWith(FakeAudio.last, 0.4)
  })

  it('play() recusado: false e solta a rota de áudio', async () => {
    FakeAudio.playResult = Promise.reject(new Error('autoplay'))
    await expect(playEntranceClip('/s', 1)).resolves.toBe(false)
    expect(route.stop).toHaveBeenCalled()
  })

  it('erro ao carregar (404, formato): false', async () => {
    FakeAudio.playResult = new Promise(() => {})
    const result = playEntranceClip('/s', 1)
    FakeAudio.last.fire('error')
    await expect(result).resolves.toBe(false)
    expect(route.stop).toHaveBeenCalled()
  })

  it('para sozinho no fim ou depois do teto (arquivo maior do que o declarado)', async () => {
    await playEntranceClip('/s', 1)
    FakeAudio.last.fire('ended')
    expect(route.stop).toHaveBeenCalledOnce()

    route.stop.mockClear()
    await playEntranceClip('/s', 1)
    vi.advanceTimersByTime(MAX_ENTRANCE_CLIP_MS)
    expect(FakeAudio.last.pause).toHaveBeenCalled()
    expect(route.stop).toHaveBeenCalledOnce()
  })

  it('sem <audio> (ambiente sem mídia): false', async () => {
    vi.stubGlobal('Audio', undefined)
    await expect(playEntranceClip('/s', 1)).resolves.toBe(false)
  })
})
