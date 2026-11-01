import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPiperSpeaker } from './piperEngine'
import { createTTSQueue } from './ttsQueue'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- dublê de teste
function setup(wav: Uint8Array | null = new Uint8Array([1])) {
  const plays: Array<{ wav: Uint8Array; onEnd: () => void; stop: ReturnType<typeof vi.fn> }> = []
  const synthesize = vi.fn<(text: string) => Promise<Uint8Array | null>>(async () => wav)
  const play = vi.fn((w: Uint8Array, onEnd: () => void) => {
    const stop = vi.fn()
    plays.push({ wav: w, onEnd, stop })
    return stop
  })
  return { speaker: createPiperSpeaker({ synthesize, play }), synthesize, play, plays }
}

afterEach(() => vi.useRealTimers())

describe('createPiperSpeaker', () => {
  it('sintetiza no main e toca o WAV; o fim do áudio solta a fila', async () => {
    const { speaker, synthesize, plays } = setup()
    const onEnd = vi.fn()
    speaker.speak('Ana disse: oi', onEnd)
    expect(synthesize).toHaveBeenCalledWith('Ana disse: oi')
    await vi.waitFor(() => expect(plays).toHaveLength(1))
    expect(onEnd).not.toHaveBeenCalled()
    plays[0].onEnd()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('voz ainda não pronta (null): não toca e solta a fila', async () => {
    const { speaker, play } = setup(null)
    const onEnd = vi.fn()
    speaker.speak('oi', onEnd)
    await vi.waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1))
    expect(play).not.toHaveBeenCalled()
  })

  it('síntese falhou: solta a fila', async () => {
    const play = vi.fn()
    const speaker = createPiperSpeaker({ synthesize: () => Promise.reject(new Error('x')), play })
    const onEnd = vi.fn()
    speaker.speak('oi', onEnd)
    await vi.waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1))
    expect(play).not.toHaveBeenCalled()
  })

  it('cancelar para o áudio tocando; síntese que chega depois do cancelar não toca', async () => {
    const { speaker, plays, play } = setup()
    speaker.speak('um', () => {})
    await vi.waitFor(() => expect(plays).toHaveLength(1))
    speaker.cancel()
    expect(plays[0].stop).toHaveBeenCalled()

    speaker.speak('dois', () => {})
    speaker.cancel()
    await new Promise((r) => setTimeout(r, 0))
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('áudio que nunca avisa o fim não trava a fila', async () => {
    vi.useFakeTimers()
    const { speaker, plays } = setup()
    const onEnd = vi.fn()
    speaker.speak('oi', onEnd)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(plays[0].stop).toHaveBeenCalled()
  })

  it('na fila atual: uma fala por vez, limpar corta a atual', async () => {
    const { speaker, synthesize, plays } = setup()
    const queue = createTTSQueue(speaker)
    queue.enqueue('um')
    queue.enqueue('dois')
    await vi.waitFor(() => expect(plays).toHaveLength(1))
    expect(synthesize).toHaveBeenCalledTimes(1)
    plays[0].onEnd()
    await vi.waitFor(() => expect(plays).toHaveLength(2))
    queue.clear()
    expect(plays[1].stop).toHaveBeenCalled()
  })
})
