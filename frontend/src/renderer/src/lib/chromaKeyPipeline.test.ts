import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_CHROMA_KEY, type ChromaKeySettings } from './chromaKey'
import {
  CHROMA_MAX_PIXELS,
  createChromaKeyPipeline,
  processingSize,
  type PipelineEnv
} from './chromaKeyPipeline'

const GREEN = [0, 177, 64, 255]

function fakeTrack(): { stop: ReturnType<typeof vi.fn>; contentHint: string } {
  return { stop: vi.fn(), contentHint: '' }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function setup(over: Partial<ChromaKeySettings> = {}, imageData?: number[]) {
  const settings: ChromaKeySettings = { ...DEFAULT_CHROMA_KEY, enabled: true, ...over }
  const sourceTrack = { ...fakeTrack(), getSettings: () => ({ width: 1280, height: 720 }) }
  const source = {
    getVideoTracks: () => [sourceTrack],
    getTracks: () => [sourceTrack]
  } as unknown as MediaStream

  const outTrack = fakeTrack()
  const outStream = { getVideoTracks: () => [outTrack], getTracks: () => [outTrack] }
  const pixels = new Uint8ClampedArray(imageData ?? [...GREEN])
  const ctx = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: pixels })),
    putImageData: vi.fn()
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    captureStream: vi.fn(() => outStream)
  }
  const video = {
    muted: false,
    playsInline: false,
    srcObject: null as unknown,
    readyState: 4,
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn()
  }
  let pending: (() => void) | null = null
  const cancel = vi.fn()
  const env: PipelineEnv = {
    createCanvas: () => canvas as unknown as HTMLCanvasElement,
    createVideo: () => video as unknown as HTMLVideoElement,
    loadImage: vi.fn(() => Promise.reject(new Error('sem imagem'))),
    schedule: (_v, cb) => {
      pending = cb
      return cancel
    }
  }
  const getSettings = vi.fn(() => settings)
  const pipeline = createChromaKeyPipeline(source, getSettings, env)
  const tick = (): void => {
    const cb = pending
    pending = null
    cb?.()
  }
  return {
    pipeline,
    ctx,
    canvas,
    video,
    env,
    settings,
    sourceTrack,
    outTrack,
    pixels,
    tick,
    cancel,
    getSettings
  }
}

describe('processingSize', () => {
  it('mantém câmeras pequenas como estão', () => {
    expect(processingSize(640, 360)).toEqual({ width: 640, height: 360 })
  })
  it('reduz 720p para caber no orçamento, mantendo a proporção', () => {
    const { width, height } = processingSize(1280, 720)
    expect(width * height).toBeLessThanOrEqual(CHROMA_MAX_PIXELS + width + height)
    expect(width / height).toBeCloseTo(16 / 9, 1)
  })
  it('dimensões inválidas caem num tamanho padrão', () => {
    expect(processingSize(0, 0)).toEqual({ width: 640, height: 360 })
  })
})

describe('createChromaKeyPipeline', () => {
  it('devolve o stream do canvas e dimensiona pelo orçamento', () => {
    const t = setup()
    expect(t.canvas.captureStream).toHaveBeenCalledWith(30)
    expect(t.canvas.width).toBeLessThan(1280)
    expect(t.outTrack.contentHint).toBe('motion')
    expect(t.video.srcObject).not.toBeNull()
    expect(t.video.muted).toBe(true)
  })

  it('a cada quadro remove o fundo e reagenda', () => {
    const t = setup()
    t.tick()
    expect(t.ctx.drawImage).toHaveBeenCalledTimes(1)
    expect(t.ctx.putImageData).toHaveBeenCalledTimes(1)
    // o pixel verde virou a cor de fundo padrão (#1e1f22)
    expect([...t.pixels.slice(0, 3)]).toEqual([30, 31, 34])
    t.tick()
    expect(t.ctx.drawImage).toHaveBeenCalledTimes(2)
  })

  it('lê as configurações a cada quadro (valem ao vivo)', () => {
    const t = setup()
    t.tick()
    t.tick()
    expect(t.getSettings).toHaveBeenCalledTimes(2)
  })

  it('com o efeito desligado só copia o quadro (sem getImageData)', () => {
    const t = setup({ enabled: false })
    t.tick()
    expect(t.ctx.drawImage).toHaveBeenCalledTimes(1)
    expect(t.ctx.getImageData).not.toHaveBeenCalled()
    expect(t.ctx.putImageData).not.toHaveBeenCalled()
  })

  it('espera o vídeo ter quadro antes de processar', () => {
    const t = setup()
    t.video.readyState = 0
    t.tick()
    expect(t.ctx.drawImage).not.toHaveBeenCalled()
    t.video.readyState = 4
    t.tick()
    expect(t.ctx.drawImage).toHaveBeenCalledTimes(1)
  })

  it('imagem que não carrega usa a cor sólida', async () => {
    const t = setup({
      background: { mode: 'image', color: '#102030', image: 'data:image/png;base64,AAA' }
    })
    t.tick()
    await Promise.resolve()
    t.tick()
    expect(t.env.loadImage).toHaveBeenCalledTimes(1)
    expect([...t.pixels.slice(0, 3)]).toEqual([0x10, 0x20, 0x30])
  })

  it('erro num quadro não derruba o loop', () => {
    const t = setup()
    t.ctx.getImageData.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    t.tick()
    t.tick()
    expect(t.ctx.putImageData).toHaveBeenCalledTimes(1)
  })

  it('destroy para o loop e as tracks (inclusive a da câmera) e é idempotente', () => {
    const t = setup()
    t.pipeline.destroy()
    t.pipeline.destroy()
    expect(t.cancel).toHaveBeenCalledTimes(1)
    expect(t.outTrack.stop).toHaveBeenCalledTimes(1)
    expect(t.sourceTrack.stop).toHaveBeenCalledTimes(1)
    expect(t.video.srcObject).toBeNull()
    t.tick()
    expect(t.ctx.drawImage).not.toHaveBeenCalled()
  })

  it('sem canvas 2d lança (o chamador cai para a câmera crua)', () => {
    const env = {
      createCanvas: () => ({ getContext: () => null }) as unknown as HTMLCanvasElement,
      createVideo: () => ({ play: () => Promise.resolve() }) as unknown as HTMLVideoElement,
      loadImage: vi.fn(),
      schedule: () => () => {}
    } as PipelineEnv
    const src = { getVideoTracks: () => [], getTracks: () => [] } as unknown as MediaStream
    expect(() => createChromaKeyPipeline(src, () => DEFAULT_CHROMA_KEY, env)).toThrow()
  })
})
