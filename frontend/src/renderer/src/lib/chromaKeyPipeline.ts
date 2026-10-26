import { applyChromaKey, hexToRgb, type ChromaKeySettings, type RGB } from './chromaKey'

/** Teto de pixels processados por quadro (~960x540): mantém o FPS no main thread. */
export const CHROMA_MAX_PIXELS = 518_400
const OUTPUT_FPS = 30
/** Cor de fundo de segurança (a mesma do padrão) quando a configurada for inválida. */
const FALLBACK_BG: RGB = [30, 31, 34]

export interface ChromaKeyPipeline {
  /** Stream já processado: é o que vai para a prévia local e para a sala. */
  stream: MediaStream
  /** Para o loop e as tracks (a da câmera original também). Idempotente. */
  destroy: () => void
}

/** Dependências do navegador, injetáveis para testar sem DOM. */
export interface PipelineEnv {
  createCanvas: () => HTMLCanvasElement
  createVideo: () => HTMLVideoElement
  loadImage: (src: string) => Promise<HTMLImageElement>
  /** Agenda o próximo quadro; devolve o cancelamento. */
  schedule: (video: HTMLVideoElement, cb: () => void) => () => void
}

export const browserEnv: PipelineEnv = {
  createCanvas: () => document.createElement('canvas'),
  createVideo: () => document.createElement('video'),
  loadImage: (src) =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('imagem inválida'))
      img.src = src
    }),
  schedule: (video, cb) => {
    if ('requestVideoFrameCallback' in video) {
      const id = video.requestVideoFrameCallback(() => cb())
      return () => video.cancelVideoFrameCallback(id)
    }
    const id = requestAnimationFrame(() => cb())
    return () => cancelAnimationFrame(id)
  }
}

/** Dimensões de saída: as da câmera, reduzidas para caber em CHROMA_MAX_PIXELS. */
export function processingSize(w: number, h: number): { width: number; height: number } {
  if (!(w > 0) || !(h > 0)) return { width: 640, height: 360 }
  const scale = Math.min(1, Math.sqrt(CHROMA_MAX_PIXELS / (w * h)))
  return { width: Math.max(2, Math.round(w * scale)), height: Math.max(2, Math.round(h * scale)) }
}

/**
 * Passa a câmera por um canvas, remove o fundo e devolve o stream do canvas.
 * `getSettings` é lido a cada quadro: sliders e cores valem na hora, sem
 * republicar. Com o efeito desligado o quadro só é copiado (sem getImageData).
 */
export function createChromaKeyPipeline(
  source: MediaStream,
  getSettings: () => ChromaKeySettings,
  env: PipelineEnv = browserEnv
): ChromaKeyPipeline {
  const video = env.createVideo()
  video.muted = true
  video.playsInline = true
  video.srcObject = source
  void video.play?.()?.catch?.(() => {})

  const canvas = env.createCanvas()
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas 2d indisponível')

  const trackSize = source.getVideoTracks()[0]?.getSettings?.() ?? {}
  const { width, height } = processingSize(trackSize.width ?? 0, trackSize.height ?? 0)
  canvas.width = width
  canvas.height = height

  const stream = canvas.captureStream(OUTPUT_FPS)
  stream.getVideoTracks().forEach((t) => {
    t.contentHint = 'motion'
  })

  // Imagem de fundo já recortada (cover) no tamanho do canvas.
  let bgSrc = ''
  let bgPixels: Uint8ClampedArray | null = null
  let bgLoading = false
  const ensureBackground = (src: string): void => {
    if (src === bgSrc || bgLoading) return
    bgLoading = true
    bgSrc = src
    bgPixels = null
    env
      .loadImage(src)
      .then((img) => {
        if (bgSrc !== src || destroyed) return
        const c = env.createCanvas()
        c.width = canvas.width
        c.height = canvas.height
        const bctx = c.getContext('2d')
        if (!bctx) return
        const k = Math.max(c.width / img.width, c.height / img.height)
        const dw = img.width * k
        const dh = img.height * k
        bctx.drawImage(img, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh)
        bgPixels = bctx.getImageData(0, 0, c.width, c.height).data
      })
      .catch(() => {})
      .finally(() => {
        bgLoading = false
      })
  }

  let destroyed = false
  let cancel: (() => void) | null = null

  const frame = (): void => {
    if (destroyed) return
    cancel = env.schedule(video, frame)
    if (video.readyState < 2) return
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const s = getSettings()
      if (!s.enabled) return
      let bg: RGB | Uint8ClampedArray = hexToRgb(s.background.color) ?? FALLBACK_BG
      if (s.background.mode === 'image' && s.background.image) {
        ensureBackground(s.background.image)
        if (bgPixels && bgSrc === s.background.image) bg = bgPixels
      }
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
      if (Array.isArray(bg) || bg.length === img.data.length) {
        applyChromaKey(img.data, s, bg)
        ctx.putImageData(img, 0, 0)
      }
    } catch {
      // Um quadro ruim não derruba o loop.
    }
  }
  cancel = env.schedule(video, frame)

  return {
    stream,
    destroy: () => {
      if (destroyed) return
      destroyed = true
      cancel?.()
      stream.getTracks().forEach((t) => t.stop())
      source.getTracks().forEach((t) => t.stop())
      video.pause?.()
      video.srcObject = null
    }
  }
}
