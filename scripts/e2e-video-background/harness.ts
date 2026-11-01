// Página de teste do e2e-video-background.mjs: roda o pipeline de fundo de
// verdade (MediaPipe + canvas) sobre uma foto, sem backend nem login.
import {
  createBackgroundPipeline,
  type BackgroundEffect
} from '../../frontend/src/renderer/src/features/call/lib/backgroundPipeline'
import { PRESET_BACKGROUNDS } from '../../frontend/src/renderer/src/features/call/lib/videoBackground'
import { gifStorage } from '../../frontend/src/renderer/src/features/call/lib/gifStorage'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const SIZE = 480
let effect: BackgroundEffect = { mode: 'none', image: null }
let video: HTMLVideoElement
let failed = false
let cleanup: (() => void) | null = null

const probe = document.createElement('canvas')
probe.width = SIZE
probe.height = SIZE
const pctx = probe.getContext('2d', { willReadFrequently: true })!

/** Energia de borda (gradiente médio) e cor média de uma região: nitidez x desfoque. */
function stats(data: Uint8ClampedArray, w: number, r: Rect): { sharp: number; mean: number[] } {
  let grad = 0
  let n = 0
  const mean = [0, 0, 0]
  const gray = (x: number, y: number): number => {
    const i = (y * w + x) * 4
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  for (let y = r.y; y < r.y + r.h - 1; y++) {
    for (let x = r.x; x < r.x + r.w - 1; x++) {
      grad += Math.abs(gray(x + 1, y) - gray(x, y)) + Math.abs(gray(x, y + 1) - gray(x, y))
      const i = (y * w + x) * 4
      mean[0] += data[i]
      mean[1] += data[i + 1]
      mean[2] += data[i + 2]
      n++
    }
  }
  return { sharp: grad / n, mean: mean.map((m) => m / n) }
}

const api = {
  presets: PRESET_BACKGROUNDS.map((p) => ({ id: p.id, dataUrl: p.dataUrl })),

  /** Liga a "câmera" (a foto num canvas) e o pipeline; resolve com o tamanho do vídeo de saída. */
  async start(photo: string): Promise<{ width: number; height: number }> {
    const img = new Image()
    img.src = photo
    await img.decode()
    const src = document.createElement('canvas')
    src.width = SIZE
    src.height = SIZE
    const sctx = src.getContext('2d')!
    const paint = (): void => sctx.drawImage(img, 0, 0, SIZE, SIZE)
    paint()
    const timer = setInterval(paint, 33)
    const raw = src.captureStream(30)
    const pipeline = createBackgroundPipeline(raw, () => effect, undefined, () => {
      failed = true
    })
    cleanup = () => {
      clearInterval(timer)
      pipeline.destroy()
    }
    video = document.createElement('video')
    video.muted = true
    video.srcObject = pipeline.stream
    document.body.appendChild(video)
    await video.play()
    return { width: video.videoWidth, height: video.videoHeight }
  },

  /** gifStorage de verdade (IndexedDB): guarda, lê, confere o conteúdo e apaga. */
  async gifRoundTrip(base64: string): Promise<{ same: boolean; deleted: boolean }> {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: 'image/gif' })
    await gifStorage.put('e2e-gif', blob)
    const back = await gifStorage.get('e2e-gif')
    const same =
      back !== null &&
      back.size === bytes.length &&
      new Uint8Array(await back.arrayBuffer()).every((v, i) => v === bytes[i])
    await gifStorage.delete('e2e-gif')
    return { same, deleted: (await gifStorage.get('e2e-gif')) === null }
  },

  /** Fundo GIF como o app faz: o arquivo (blob) vai junto com o blob: que o identifica. */
  setGifEffect(base64: string): void {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: 'image/gif' })
    effect = { mode: 'image', image: URL.createObjectURL(blob), blob }
  },

  setEffect(next: BackgroundEffect): void {
    effect = next
  },

  failed: (): boolean => failed,

  /** Região do quadro de saída (após `wait` ms). */
  async sample(rect: Rect, wait = 1500): Promise<{ sharp: number; mean: number[] }> {
    await new Promise((r) => setTimeout(r, wait))
    pctx.drawImage(video, 0, 0, SIZE, SIZE)
    return stats(pctx.getImageData(0, 0, SIZE, SIZE).data, SIZE, rect)
  },

  /** Quadros de saída por segundo durante `ms`. */
  async fps(ms = 3000): Promise<number> {
    let frames = 0
    const t0 = performance.now()
    await new Promise<void>((res) => {
      const f = (): void => {
        frames++
        if (performance.now() - t0 < ms) video.requestVideoFrameCallback(f)
        else res()
      }
      video.requestVideoFrameCallback(f)
    })
    return frames / ((performance.now() - t0) / 1000)
  },

  stop(): void {
    cleanup?.()
  }
}

;(window as unknown as { H: typeof api }).H = api
