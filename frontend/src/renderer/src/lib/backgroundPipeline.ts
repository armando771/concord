import { confidenceToAlpha, coverRect, erodeMask, processingSize, smoothMask } from './segmentation'
import type { PersonMask, PersonSegmenter } from './personSegmenter'
import type { BackgroundMode } from './videoBackground'
import { decodeGif } from './gifFrames'

const OUTPUT_FPS = 30
/** Peso da máscara nova na média com a anterior (1 = sem suavização). */
const MASK_BLEND = 0.6
/** Acima disso o quadro atrasou: passa a segmentar um quadro sim, um não. */
const SLOW_MS = 26
const FAST_MS = 14
/** Quadros seguidos sem máscara até desistir do efeito. */
const MAX_FAILURES = 15

/** O que o pipeline desenha agora (lido a cada quadro: trocar o fundo vale na hora). */
export interface BackgroundEffect {
  mode: BackgroundMode
  /** Data URL (ou blob:) da imagem do modo `image`; também identifica a imagem. */
  image: string | null
  /** O arquivo do GIF animado: com ele os quadros são decodificados e tocam sozinhos. */
  blob?: Blob | null
}

/** Imagem de fundo pronta para desenhar: estática ou GIF animado. */
export interface BackgroundImage {
  width: number
  height: number
  /** O que desenhar agora (`nowMs` escolhe o quadro do GIF). */
  frame: (nowMs: number) => CanvasImageSource
  release: () => void
}

export type PipelineError = 'segmenter'

export interface BackgroundPipeline {
  /** Stream já processado: é o que vai para a prévia local e para a sala. */
  stream: MediaStream
  /** Troca a câmera de origem sem recriar o stream publicado. A antiga é parada. */
  setSource: (source: MediaStream) => void
  /** Para o loop e as tracks (a da câmera também). Idempotente. */
  destroy: () => void
  /** Para o loop e a saída, mas deixa a câmera ligada e a devolve (efeito desligado ao vivo). */
  detach: () => MediaStream
}

/** Dependências do navegador, injetáveis para testar sem DOM. */
export interface PipelineEnv {
  createCanvas: () => HTMLCanvasElement
  createVideo: () => HTMLVideoElement
  loadImage: (src: string, blob?: Blob | null) => Promise<BackgroundImage>
  /** Agenda o próximo quadro; devolve o cancelamento. */
  schedule: (video: HTMLVideoElement, cb: () => void) => () => void
  now: () => number
  loadSegmenter: () => Promise<PersonSegmenter | null>
}

function loadElement(src: string): Promise<BackgroundImage> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      // Sem ImageDecoder o GIF só anima enquanto o <img> está na página: fica lá, invisível.
      Object.assign(img.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        width: '1px',
        height: '1px',
        opacity: '0',
        pointerEvents: 'none'
      })
      img.setAttribute('aria-hidden', 'true')
      document.body.appendChild(img)
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        frame: () => img,
        release: () => img.remove()
      })
    }
    img.onerror = () => reject(new Error('imagem inválida'))
    img.src = src
  })
}

export const browserEnv: PipelineEnv = {
  createCanvas: () => document.createElement('canvas'),
  createVideo: () => document.createElement('video'),
  loadImage: async (src, blob) => {
    // GIF animado: quadros decodificados (WebCodecs); sem isso cai no <img>.
    const gif = blob ? await decodeGif(blob) : null
    if (gif) {
      return {
        width: gif.width,
        height: gif.height,
        frame: (ms) => gif.frameAt(ms),
        release: gif.close
      }
    }
    return loadElement(src)
  },
  schedule: (video, cb) => {
    if ('requestVideoFrameCallback' in video) {
      const id = video.requestVideoFrameCallback(() => cb())
      return () => video.cancelVideoFrameCallback(id)
    }
    const id = requestAnimationFrame(() => cb())
    return () => cancelAnimationFrame(id)
  },
  now: () => performance.now(),
  // Import dinâmico: o WASM do MediaPipe só é baixado quando um efeito é usado.
  loadSegmenter: () => import('./personSegmenter').then((m) => m.loadPersonSegmenter())
}

/**
 * Passa a câmera por um canvas, troca o fundo (desfoque ou imagem) e devolve o
 * stream do canvas. Enquanto o modelo carrega, o quadro inteiro sai desfocado:
 * nunca vaza o fundo de verdade. Se o modelo não carregar, chama `onError` (o
 * chamador volta para a câmera crua).
 */
export function createBackgroundPipeline(
  initialSource: MediaStream,
  getEffect: () => BackgroundEffect,
  env: PipelineEnv = browserEnv,
  onError?: (error: PipelineError) => void
): BackgroundPipeline {
  let source = initialSource
  const video = env.createVideo()
  video.muted = true
  video.playsInline = true
  video.srcObject = source
  void video.play?.()?.catch?.(() => {})

  const canvas = env.createCanvas()
  const ctx = canvas.getContext('2d')
  const person = env.createCanvas()
  const pctx = person.getContext('2d')
  const maskCanvas = env.createCanvas()
  const mctx = maskCanvas.getContext('2d')
  if (!ctx || !pctx || !mctx) throw new Error('canvas 2d indisponível')

  const stream = canvas.captureStream(OUTPUT_FPS)
  stream.getVideoTracks().forEach((t) => {
    t.contentHint = 'motion'
  })

  let destroyed = false
  let cancel: (() => void) | null = null
  let segmenter: PersonSegmenter | null = null
  let maskData: Float32Array = new Float32Array(0)
  let eroded: Float32Array = new Float32Array(0)
  let maskImage: ImageData | null = null
  let hasMask = false
  let failures = 0
  let errored = false
  let stride = 1
  let sinceSegment = 0

  const fail = (): void => {
    if (errored || destroyed) return
    errored = true
    onError?.('segmenter')
  }

  void env
    .loadSegmenter()
    .then((s) => {
      if (destroyed) return
      if (!s) return fail()
      segmenter = s
    })
    .catch(fail)

  // Imagem de fundo
  let bgSrc = ''
  let bgImage: BackgroundImage | null = null
  const dropImage = (): void => {
    bgImage?.release()
    bgImage = null
  }
  const ensureImage = (src: string, blob?: Blob | null): BackgroundImage | null => {
    if (src === bgSrc) return bgImage
    bgSrc = src
    dropImage()
    env
      .loadImage(src, blob)
      .then((img) => {
        if (bgSrc === src && !destroyed) bgImage = img
        else img.release()
      })
      .catch(() => {})
    return null
  }

  const ensureSize = (): boolean => {
    const { width, height } = processingSize(video.videoWidth, video.videoHeight)
    if (canvas.width === width && canvas.height === height) return false
    canvas.width = width
    canvas.height = height
    person.width = width
    person.height = height
    return true
  }

  const blurPx = (): number => Math.max(4, Math.round(canvas.width / 48))

  const drawBlurredFrame = (): void => {
    ctx.filter = `blur(${blurPx()}px)`
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    ctx.filter = 'none'
  }

  const updateMask = (): void => {
    if (!segmenter) return
    const r: PersonMask | null = segmenter.segment(video, env.now())
    if (!r) {
      failures++
      if (failures >= MAX_FAILURES) fail()
      return
    }
    failures = 0
    if (maskCanvas.width !== r.width || maskCanvas.height !== r.height) {
      maskCanvas.width = r.width
      maskCanvas.height = r.height
      maskImage = mctx.createImageData(r.width, r.height)
      eroded = new Float32Array(r.width * r.height)
      hasMask = false
    }
    maskData = hasMask ? smoothMask(maskData, r.data, MASK_BLEND) : Float32Array.from(r.data)
    hasMask = true
    erodeMask(maskData, eroded, r.width, r.height)
    confidenceToAlpha(eroded, maskImage!.data)
    mctx.putImageData(maskImage!, 0, 0)
  }

  const frame = (): void => {
    if (destroyed) return
    cancel = env.schedule(video, frame)
    if (video.readyState < 2) return
    ensureSize()
    const t0 = env.now()
    const effect = getEffect()

    if (effect.mode === 'none') {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      return
    }
    // Fora do modo imagem solta a imagem (um GIF decodificado ocupa memória).
    if (effect.mode !== 'image' || !effect.image) {
      if (bgSrc) {
        dropImage()
        bgSrc = ''
      }
    }
    const image =
      effect.mode === 'image' && effect.image ? ensureImage(effect.image, effect.blob) : null
    if (segmenter && sinceSegment++ % stride === 0) updateMask()
    // Modelo (ou imagem) ainda carregando: tudo desfocado, sem vazar o fundo.
    if (!segmenter || !hasMask || (effect.mode === 'image' && !image)) {
      drawBlurredFrame()
      return
    }

    // 1) fundo
    if (effect.mode === 'image' && image) {
      const r = coverRect(image.width, image.height, canvas.width, canvas.height)
      ctx.drawImage(image.frame(env.now()), r.x, r.y, r.w, r.h)
    } else {
      drawBlurredFrame()
    }
    // 2) pessoa: quadro recortado pela máscara (borda levemente suavizada)
    pctx.globalCompositeOperation = 'source-over'
    pctx.clearRect(0, 0, person.width, person.height)
    pctx.drawImage(video, 0, 0, person.width, person.height)
    pctx.globalCompositeOperation = 'destination-in'
    pctx.filter = `blur(${Math.max(1, canvas.width / 480)}px)`
    pctx.drawImage(maskCanvas, 0, 0, person.width, person.height)
    pctx.filter = 'none'
    pctx.globalCompositeOperation = 'source-over'
    // 3) pessoa por cima do fundo
    ctx.drawImage(person, 0, 0)

    // Quadro que passou do orçamento: segmenta um sim, um não, até aliviar.
    const dt = env.now() - t0
    if (dt > SLOW_MS) stride = 2
    else if (dt < FAST_MS) stride = 1
  }

  cancel = env.schedule(video, frame)

  const stopLoop = (): void => {
    destroyed = true
    dropImage()
    cancel?.()
    stream.getTracks().forEach((t) => t.stop())
    video.pause?.()
    video.srcObject = null
  }

  return {
    stream,
    setSource: (next) => {
      if (destroyed || next === source) return
      const old = source
      source = next
      video.srcObject = next
      void video.play?.()?.catch?.(() => {})
      old.getTracks().forEach((t) => t.stop())
    },
    destroy: () => {
      if (destroyed) return
      stopLoop()
      source.getTracks().forEach((t) => t.stop())
    },
    detach: () => {
      if (!destroyed) stopLoop()
      return source
    }
  }
}
