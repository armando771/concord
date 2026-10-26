import { describe, expect, it, vi } from 'vitest'
import {
  createBackgroundPipeline,
  type BackgroundEffect,
  type BackgroundImage,
  type PipelineEnv
} from './backgroundPipeline'
import type { PersonMask, PersonSegmenter } from './personSegmenter'

interface FakeCtx {
  filter: string
  globalCompositeOperation: string
  calls: string[]
  drawImage: ReturnType<typeof vi.fn>
  clearRect: ReturnType<typeof vi.fn>
  putImageData: ReturnType<typeof vi.fn>
  createImageData: ReturnType<typeof vi.fn>
}

function fakeCtx(name: string, log: string[]): FakeCtx {
  const ctx: FakeCtx = {
    filter: 'none',
    globalCompositeOperation: 'source-over',
    calls: [],
    drawImage: vi.fn((img: unknown) => {
      const what = (img as { tag?: string })?.tag ?? 'img'
      log.push(`${name}.draw(${what}) filter=${ctx.filter} op=${ctx.globalCompositeOperation}`)
    }),
    clearRect: vi.fn(),
    putImageData: vi.fn(() => log.push(`${name}.putMask`)),
    createImageData: vi.fn((w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }))
  }
  return ctx
}

function fakeTrack(): { stop: ReturnType<typeof vi.fn>; contentHint: string } {
  return { stop: vi.fn(), contentHint: '' }
}

function fakeStream(): { stream: MediaStream; track: ReturnType<typeof fakeTrack> } {
  const track = fakeTrack()
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track]
  } as unknown as MediaStream
  return { stream, track }
}

function mask(value: number): PersonMask {
  return { data: new Float32Array(4).fill(value), width: 2, height: 2 }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function setup(
  opts: { effect?: BackgroundEffect; segmenter?: PersonSegmenter | null; loadFails?: boolean } = {}
) {
  const log: string[] = []
  const main = fakeCtx('main', log)
  const person = fakeCtx('person', log)
  const maskCtx = fakeCtx('mask', log)
  const canvases = [main, person, maskCtx]
  let created = 0
  const mkCanvas = (): HTMLCanvasElement => {
    const ctx = canvases[created++ % canvases.length]
    const c = {
      width: 300,
      height: 150,
      tag: 'canvas' + created,
      getContext: () => ctx,
      captureStream: vi.fn(() => out.stream)
    }
    return c as unknown as HTMLCanvasElement
  }
  const out = fakeStream()
  const src = fakeStream()
  const video = {
    tag: 'video',
    muted: false,
    playsInline: false,
    srcObject: null as unknown,
    readyState: 4,
    videoWidth: 640,
    videoHeight: 360,
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn()
  }
  let pending: (() => void) | null = null
  const cancel = vi.fn()
  let clock = 0
  const segmenter: PersonSegmenter | null =
    opts.segmenter === undefined
      ? { segment: vi.fn(() => mask(1)), close: vi.fn() }
      : opts.segmenter
  // Cada imagem carregada: o que foi desenhado (tag) e o spy de release.
  const released: string[] = []
  const loadImage = vi.fn<PipelineEnv['loadImage']>((src) => {
    const img = {
      tag: 'bg:' + src,
      width: 100,
      height: 100,
      frame: () => img,
      release: vi.fn(() => released.push(src))
    }
    return Promise.resolve(img as unknown as BackgroundImage)
  })
  const env: PipelineEnv = {
    createCanvas: mkCanvas,
    createVideo: () => video as unknown as HTMLVideoElement,
    loadImage,
    schedule: (_v, cb) => {
      pending = cb
      return cancel
    },
    now: () => (clock += 1),
    loadSegmenter: () =>
      opts.loadFails ? Promise.reject(new Error('x')) : Promise.resolve(segmenter)
  }
  let effect: BackgroundEffect = opts.effect ?? { mode: 'blur', image: null }
  const onError = vi.fn()
  const pipeline = createBackgroundPipeline(src.stream, () => effect, env, onError)
  const tick = (): void => {
    const cb = pending
    pending = null
    cb?.()
  }
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 5; i++) await Promise.resolve()
  }
  return {
    pipeline,
    log,
    main,
    person,
    maskCtx,
    video,
    env,
    segmenter,
    src,
    out,
    tick,
    settle,
    cancel,
    onError,
    loadImage,
    released,
    setEffect: (e: BackgroundEffect) => (effect = e),
    advance: (ms: number) => (clock += ms)
  }
}

describe('createBackgroundPipeline', () => {
  it('devolve o stream do canvas, com dica de movimento', () => {
    const t = setup()
    expect(t.pipeline.stream).toBe(t.out.stream)
    expect(t.out.track.contentHint).toBe('motion')
    expect(t.video.muted).toBe(true)
  })

  it('sem canvas 2d lança (o chamador cai para a câmera crua)', () => {
    const env = {
      createCanvas: () =>
        ({ getContext: () => null, captureStream: vi.fn() }) as unknown as HTMLCanvasElement,
      createVideo: () => ({ play: () => Promise.resolve() }) as unknown as HTMLVideoElement,
      loadImage: vi.fn(),
      schedule: () => () => {},
      now: () => 0,
      loadSegmenter: () => Promise.resolve(null)
    } as PipelineEnv
    expect(() =>
      createBackgroundPipeline(fakeStream().stream, () => ({ mode: 'blur', image: null }), env)
    ).toThrow()
  })

  it('"nenhum" só copia o quadro (sem segmentar)', async () => {
    const t = setup({ effect: { mode: 'none', image: null } })
    await t.settle()
    t.tick()
    expect(t.main.drawImage).toHaveBeenCalledTimes(1)
    expect(t.segmenter?.segment).not.toHaveBeenCalled()
  })

  it('enquanto o modelo carrega o quadro sai todo desfocado (não vaza o fundo)', () => {
    const t = setup()
    t.tick()
    expect(t.log).toEqual([expect.stringMatching(/^main\.draw\(video\) filter=blur\(\d+px\)/)])
    expect(t.segmenter?.segment).not.toHaveBeenCalled()
  })

  it('desfoque: fundo desfocado, pessoa recortada pela máscara por cima', async () => {
    const t = setup()
    await t.settle()
    t.tick()
    expect(t.log).toEqual([
      'mask.putMask',
      expect.stringMatching(/^main\.draw\(video\) filter=blur\(\d+px\)/),
      'person.draw(video) filter=none op=source-over',
      expect.stringMatching(/^person\.draw\(canvas\d+\) filter=blur\(.*\) op=destination-in/),
      'main.draw(canvas2) filter=none op=source-over'
    ])
    expect(t.person.globalCompositeOperation).toBe('source-over')
    expect(t.main.filter).toBe('none')
  })

  it('imagem: carrega a imagem e desenha cover no fundo', async () => {
    const t = setup({ effect: { mode: 'image', image: 'data:image/svg+xml,a' } })
    await t.settle()
    t.tick() // dispara o carregamento: ainda desfocado
    expect(t.log.some((l) => l.startsWith('main.draw(video) filter=blur'))).toBe(true)
    await t.settle()
    t.log.length = 0
    t.tick()
    expect(t.loadImage).toHaveBeenCalledTimes(1)
    expect(t.log).toContain('main.draw(bg:data:image/svg+xml,a) filter=none op=source-over')
    expect(t.log.some((l) => l.startsWith('main.draw(video)'))).toBe(false)
  })

  it('solta a imagem de fundo ao trocar, ao sair do modo imagem e ao encerrar', async () => {
    const A = 'data:image/svg+xml,a'
    const B = 'data:image/svg+xml,b'
    const t = setup({ effect: { mode: 'image', image: A } })
    await t.settle()
    t.tick()
    await t.settle()
    t.setEffect({ mode: 'image', image: B })
    t.tick()
    await t.settle()
    expect(t.released).toEqual([A])
    t.tick()
    // sair do modo imagem solta a atual (um GIF decodificado ocupa memória)
    t.setEffect({ mode: 'blur', image: null })
    t.tick()
    expect(t.released).toEqual([A, B])
    t.pipeline.destroy()
    expect(t.released).toEqual([A, B]) // nada para soltar de novo
  })

  it('encerrar solta a imagem que estava em uso', async () => {
    const t = setup({ effect: { mode: 'image', image: 'data:image/svg+xml,a' } })
    await t.settle()
    t.tick()
    await t.settle()
    t.tick()
    t.pipeline.destroy()
    expect(t.released).toEqual(['data:image/svg+xml,a'])
  })

  it('imagem que chega depois de trocar de fundo é solta na hora', async () => {
    const t = setup({ effect: { mode: 'image', image: 'data:image/svg+xml,a' } })
    await t.settle()
    t.tick() // começa a carregar a
    t.setEffect({ mode: 'image', image: 'data:image/svg+xml,b' })
    t.tick() // troca para b antes de a chegar
    await t.settle()
    expect(t.released).toContain('data:image/svg+xml,a')
  })

  it('GIF: o arquivo vai para o carregador e o quadro vem do relógio', async () => {
    const blob = { size: 5 } as unknown as Blob
    const t = setup({ effect: { mode: 'image', image: 'blob:x', blob } })
    await t.settle()
    t.tick()
    await t.settle()
    expect(t.loadImage).toHaveBeenCalledWith('blob:x', blob)
  })

  it('imagem que não carrega continua desfocada, nunca mostra o fundo real', async () => {
    const t = setup({ effect: { mode: 'image', image: 'data:image/svg+xml,a' } })
    t.loadImage.mockRejectedValue(new Error('ruim'))
    await t.settle()
    t.tick()
    await t.settle()
    t.tick()
    expect(t.log.every((l) => l.includes('filter=blur') || l.includes('putMask'))).toBe(true)
  })

  it('troca de efeito ao vivo, sem recriar o pipeline', async () => {
    const t = setup()
    await t.settle()
    t.tick()
    t.setEffect({ mode: 'none', image: null })
    t.log.length = 0
    t.tick()
    expect(t.log).toEqual(['main.draw(video) filter=none op=source-over'])
    t.setEffect({ mode: 'blur', image: null })
    t.tick()
    expect(t.log.some((l) => l.startsWith('person.'))).toBe(true)
  })

  it('suaviza a máscara entre quadros', async () => {
    const seg: PersonSegmenter = {
      segment: vi.fn().mockReturnValueOnce(mask(1)).mockReturnValue(mask(0)),
      close: vi.fn()
    }
    const t = setup({ segmenter: seg })
    await t.settle()
    t.tick()
    t.tick()
    // 2º quadro: 1 → mistura com 0, não zera de uma vez (alfa intermediário)
    const data = (t.maskCtx.createImageData.mock.results[0].value as { data: Uint8ClampedArray })
      .data
    expect(data[3]).toBeGreaterThan(0)
    expect(data[3]).toBeLessThan(255)
  })

  it('quadro lento: passa a segmentar um sim, um não', async () => {
    const t = setup()
    await t.settle()
    t.tick()
    // próximos quadros demoram: o relógio salta dentro do quadro
    const seg = t.segmenter!.segment as ReturnType<typeof vi.fn>
    seg.mockImplementation(() => {
      t.advance(40)
      return mask(1)
    })
    t.tick() // lento → stride 2
    seg.mockClear()
    for (let i = 0; i < 4; i++) t.tick()
    expect(seg.mock.calls.length).toBeLessThanOrEqual(2)
  })

  it('modelo que não carrega avisa o chamador', async () => {
    const t = setup({ segmenter: null })
    await t.settle()
    expect(t.onError).toHaveBeenCalledWith('segmenter')
    const t2 = setup({ loadFails: true })
    await t2.settle()
    expect(t2.onError).toHaveBeenCalledWith('segmenter')
  })

  it('muitos quadros seguidos sem máscara: desiste uma vez só', async () => {
    const seg: PersonSegmenter = { segment: vi.fn(() => null), close: vi.fn() }
    const t = setup({ segmenter: seg })
    await t.settle()
    for (let i = 0; i < 40; i++) t.tick()
    expect(t.onError).toHaveBeenCalledTimes(1)
  })

  it('espera o vídeo ter quadro', async () => {
    const t = setup()
    await t.settle()
    t.video.readyState = 0
    t.tick()
    expect(t.main.drawImage).not.toHaveBeenCalled()
  })

  it('setSource troca a câmera e para a antiga', () => {
    const t = setup()
    const next = fakeStream()
    t.pipeline.setSource(next.stream)
    expect(t.video.srcObject).toBe(next.stream)
    expect(t.src.track.stop).toHaveBeenCalledTimes(1)
    expect(next.track.stop).not.toHaveBeenCalled()
    t.pipeline.setSource(next.stream)
    expect(next.track.stop).not.toHaveBeenCalled()
  })

  it('destroy para loop, saída e câmera, e é idempotente', () => {
    const t = setup()
    t.pipeline.destroy()
    t.pipeline.destroy()
    expect(t.cancel).toHaveBeenCalledTimes(1)
    expect(t.out.track.stop).toHaveBeenCalledTimes(1)
    expect(t.src.track.stop).toHaveBeenCalledTimes(1)
    expect(t.video.srcObject).toBeNull()
    t.tick()
    expect(t.main.drawImage).not.toHaveBeenCalled()
  })

  it('detach para o loop e a saída, mas devolve a câmera ligada', () => {
    const t = setup()
    const raw = t.pipeline.detach()
    expect(raw).toBe(t.src.stream)
    expect(t.out.track.stop).toHaveBeenCalledTimes(1)
    expect(t.src.track.stop).not.toHaveBeenCalled()
    t.pipeline.destroy() // depois do detach: não mexe mais na câmera
    expect(t.src.track.stop).not.toHaveBeenCalled()
  })
})
