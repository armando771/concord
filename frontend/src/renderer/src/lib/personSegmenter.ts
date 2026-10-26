// Separa a pessoa do fundo com o MediaPipe (selfie_segmenter, Apache-2.0), no
// próprio aparelho: o vídeo não sai da máquina. Este módulo puxa o WASM
// (~13 MB), então só é importado (import()) quando alguém liga um efeito.
//
// App empacotado roda em file://: o `.wasm` é um asset do Vite (a CSP já libera
// 'self' no connect-src) e o modelo, pequeno, entra inline.
import wasmLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import modelDataUrl from '../assets/models/selfie_segmenter.tflite?inline'
import { dataUrlToBytes } from './segmentation'

export interface PersonMask {
  /** Confiança de ser pessoa (0..1), uma por pixel da máscara. Reaproveitado a cada chamada. */
  data: Float32Array
  width: number
  height: number
}

export interface PersonSegmenter {
  /** null = esse quadro falhou (o chamador decide quando desistir). */
  segment: (video: HTMLVideoElement, timestampMs: number) => PersonMask | null
  close: () => void
}

let loading: Promise<PersonSegmenter | null> | null = null

/** Carrega uma vez; se falhar, a próxima chamada tenta de novo. */
export function loadPersonSegmenter(): Promise<PersonSegmenter | null> {
  loading ??= create().catch(() => {
    loading = null
    return null
  })
  return loading
}

async function create(): Promise<PersonSegmenter> {
  const { ImageSegmenter } = await import('@mediapipe/tasks-vision')
  const abs = (url: string): string => new URL(url, location.href).href
  const segmenter = await ImageSegmenter.createFromOptions(
    { wasmLoaderPath: abs(wasmLoaderUrl), wasmBinaryPath: abs(wasmBinaryUrl) },
    {
      baseOptions: { modelAssetBuffer: dataUrlToBytes(modelDataUrl) },
      runningMode: 'VIDEO',
      outputConfidenceMasks: true,
      outputCategoryMask: false
    }
  )

  let buffer = new Float32Array(0)
  let lastTs = 0
  return {
    segment: (video, timestampMs) => {
      // O MediaPipe exige timestamps estritamente crescentes.
      lastTs = Math.max(lastTs + 1, Math.round(timestampMs))
      let out: PersonMask | null = null
      try {
        segmenter.segmentForVideo(video, lastTs, (result) => {
          const mask = result.confidenceMasks?.[0]
          if (!mask) return
          const src = mask.getAsFloat32Array()
          if (buffer.length !== src.length) buffer = new Float32Array(src.length)
          buffer.set(src)
          out = { data: buffer, width: mask.width, height: mask.height }
        })
      } catch {
        return null
      }
      return out
    },
    close: () => {
      loading = null
      segmenter.close()
    }
  }
}
