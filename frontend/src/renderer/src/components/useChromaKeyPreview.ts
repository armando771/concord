import { useEffect, useState } from 'react'
import { getCameraStream } from '../lib/rtc'
import { createChromaKeyPipeline } from '../lib/chromaKeyPipeline'
import { chromaKeySettings, useChromaKeyStore } from '../store/chromaKeyStore'

export interface ChromaKeyPreview {
  /** Câmera original (para comparar e para o conta-gotas). */
  original: MediaStream
  /** Câmera com o chroma key aplicado, como os outros veem. */
  result: MediaStream
}

/**
 * Prévia em tempo real das configurações. Só abre a câmera enquanto `active`
 * e fecha ao desativar/desmontar. Usa as mesmas configurações da transmissão.
 */
export function useChromaKeyPreview(active: boolean): {
  preview: ChromaKeyPreview | null
  error: string | null
} {
  const [preview, setPreview] = useState<ChromaKeyPreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    let stop: (() => void) | null = null

    void (async () => {
      try {
        const raw = await getCameraStream()
        if (cancelled) {
          raw.getTracks().forEach((t) => t.stop())
          return
        }
        // A prévia precisa dos dois: a câmera crua continua viva para exibir
        // o original, então o pipeline recebe um clone.
        const copy = raw.clone()
        const pipeline = createChromaKeyPipeline(copy, () =>
          chromaKeySettings(useChromaKeyStore.getState())
        )
        stop = () => {
          pipeline.destroy()
          raw.getTracks().forEach((t) => t.stop())
        }
        setError(null)
        setPreview({ original: raw, result: pipeline.stream })
      } catch (err) {
        if (cancelled) return
        setError(
          (err as DOMException)?.name === 'NotAllowedError'
            ? 'Permita o acesso à câmera para ver a prévia.'
            : 'Não foi possível acessar a câmera.'
        )
      }
    })()

    return () => {
      cancelled = true
      stop?.()
      setPreview(null)
    }
  }, [active])

  return { preview, error }
}
