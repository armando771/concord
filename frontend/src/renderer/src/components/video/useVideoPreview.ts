import { useEffect, useRef, useState } from 'react'
import { getCameraStream } from '../../lib/rtc'
import { createBackgroundPipeline, type BackgroundEffect } from '../../lib/backgroundPipeline'

/**
 * Prévia ao vivo do vídeo com o fundo escolhido, como os outros vão ver. Só
 * abre a câmera enquanto `active` e fecha ao desativar/desmontar. O efeito é
 * lido a cada quadro: trocar o fundo vale na hora, sem reabrir a câmera.
 */
export function useVideoPreview(
  active: boolean,
  cameraId: string,
  effect: BackgroundEffect
): { stream: MediaStream | null; error: string | null; effectFailed: boolean } {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [effectFailed, setEffectFailed] = useState(false)

  const effectRef = useRef(effect)
  // O pipeline lê o ref a cada quadro: o efeito novo vale no quadro seguinte.
  useEffect(() => {
    effectRef.current = effect
  })
  const failedRef = useRef(false)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    let stop: (() => void) | null = null
    failedRef.current = false

    void (async () => {
      try {
        const raw = await getCameraStream(cameraId)
        if (cancelled) {
          raw.getTracks().forEach((t) => t.stop())
          return
        }
        try {
          const pipeline = createBackgroundPipeline(
            raw,
            // Modelo que não carregou: mostra o vídeo normal, sem fingir o efeito.
            () => (failedRef.current ? { mode: 'none', image: null } : effectRef.current),
            undefined,
            () => {
              failedRef.current = true
              setEffectFailed(true)
            }
          )
          stop = () => pipeline.destroy()
          setStream(pipeline.stream)
        } catch {
          stop = () => raw.getTracks().forEach((t) => t.stop())
          setStream(raw)
        }
        setError(null)
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
      setStream(null)
    }
  }, [active, cameraId])

  return { stream, error, effectFailed }
}
