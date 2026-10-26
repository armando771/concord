import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeGif, frameDurationMs, frameIndexAt, gifFrameSize } from './gifFrames'

describe('frameIndexAt', () => {
  it('escolhe o quadro pelo relógio e volta ao início no fim', () => {
    const d = [100, 200, 100]
    expect(frameIndexAt(d, 0)).toBe(0)
    expect(frameIndexAt(d, 99)).toBe(0)
    expect(frameIndexAt(d, 100)).toBe(1)
    expect(frameIndexAt(d, 299)).toBe(1)
    expect(frameIndexAt(d, 300)).toBe(2)
    expect(frameIndexAt(d, 400)).toBe(0)
    expect(frameIndexAt(d, 1050)).toBe(1) // 1050 % 400 = 250
  })
  it('relógio negativo ou sem quadros não quebra', () => {
    expect(frameIndexAt([100, 100], -50)).toBe(1)
    expect(frameIndexAt([], 10)).toBe(0)
    expect(frameIndexAt([0, 0], 10)).toBe(0)
  })
})

describe('frameDurationMs', () => {
  it('converte µs para ms', () => expect(frameDurationMs(200_000)).toBe(200))
  it('sem tempo ou zero: 100 ms', () => {
    expect(frameDurationMs(null)).toBe(100)
    expect(frameDurationMs(undefined)).toBe(100)
    expect(frameDurationMs(0)).toBe(100)
  })
  it('tempo mínimo de 20 ms (GIFs de 0-10 ms tocariam rápido demais)', () => {
    expect(frameDurationMs(5_000)).toBe(20)
  })
})

describe('gifFrameSize', () => {
  it('cabe: mantém o tamanho', () => {
    expect(gifFrameSize(480, 270, 10)).toEqual({ width: 480, height: 270 })
  })
  it('muitos quadros: reduz para caber na memória, mantendo a proporção', () => {
    const { width, height } = gifFrameSize(1920, 1080, 300, 100 * 1024 * 1024)
    expect(4 * 300 * width * height).toBeLessThanOrEqual(100 * 1024 * 1024)
    expect(width / height).toBeCloseTo(16 / 9, 1)
  })
  it('entrada inválida dá 0x0', () => {
    expect(gifFrameSize(0, 10, 5)).toEqual({ width: 0, height: 0 })
    expect(gifFrameSize(10, 10, 0)).toEqual({ width: 0, height: 0 })
  })
})

describe('decodeGif', () => {
  afterEach(() => vi.unstubAllGlobals())

  const blob = { arrayBuffer: async () => new ArrayBuffer(8) } as unknown as Blob

  function fakeDecoder(frames: Array<{ duration: number | null }>): {
    Fake: never
    closed: ReturnType<typeof vi.fn>
  } {
    const closed = vi.fn()
    class Fake {
      tracks = { ready: Promise.resolve(), selectedTrack: { frameCount: frames.length } }
      decode = vi.fn(async ({ frameIndex }: { frameIndex: number }) => ({
        image: {
          displayWidth: 40,
          displayHeight: 20,
          duration: frames[frameIndex].duration,
          close: vi.fn()
        }
      }))
      close = closed
    }
    return { Fake: Fake as never, closed }
  }

  it('sem ImageDecoder devolve null (o chamador usa o <img>)', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn())
    expect(await decodeGif(blob, undefined)).toBeNull()
  })

  it('decodifica os quadros e mostra o certo em cada instante', async () => {
    const bitmaps: Array<{ n: number; close: ReturnType<typeof vi.fn> }> = []
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        const b = { n: bitmaps.length, close: vi.fn() }
        bitmaps.push(b)
        return b
      })
    )
    const { Fake, closed } = fakeDecoder([{ duration: 100_000 }, { duration: 300_000 }])
    const gif = await decodeGif(blob, Fake)
    expect(gif).not.toBeNull()
    expect(gif!.width).toBe(40)
    expect(gif!.height).toBe(20)
    expect((gif!.frameAt(0) as unknown as { n: number }).n).toBe(0)
    expect((gif!.frameAt(150) as unknown as { n: number }).n).toBe(1)
    expect((gif!.frameAt(450) as unknown as { n: number }).n).toBe(0)
    expect(closed).toHaveBeenCalledTimes(1) // o decoder não fica aberto
    gif!.close()
    expect(bitmaps.every((b) => b.close.mock.calls.length === 1)).toBe(true)
  })

  it('arquivo que não decodifica: null e sem vazar quadros', async () => {
    const made: Array<{ close: ReturnType<typeof vi.fn> }> = []
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        if (made.length === 1) throw new Error('quebrou')
        const b = { close: vi.fn() }
        made.push(b)
        return b
      })
    )
    const { Fake } = fakeDecoder([{ duration: 100_000 }, { duration: 100_000 }])
    expect(await decodeGif(blob, Fake)).toBeNull()
    expect(made[0].close).toHaveBeenCalled()
  })

  it('GIF sem quadros devolve null', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn())
    const { Fake } = fakeDecoder([])
    expect(await decodeGif(blob, Fake)).toBeNull()
  })
})
