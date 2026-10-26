import { useEffect, useState } from 'react'
import { getScreenPreview } from '../../api/calls'
import { ApiError } from '../../api/client'
import {
  previewDataUrl,
  previewPollDelay,
  PREVIEW_RETRY_MS,
  type LiveTarget
} from '../../lib/screenPreview'
import LiveBadge from '../call/LiveBadge'
import { Skeleton } from '../skeleton/Skeleton'

/**
 * Busca a foto da transmissão enquanto o cartão está aberto: rápido até a
 * primeira chegar, depois a cada 10 s. Ao fechar, para de buscar.
 */
function useScreenPreview(callId: string, userId: string): { src: string | null; ended: boolean } {
  const [src, setSrc] = useState<string | null>(null)
  const [ended, setEnded] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let hasImage = false
    let fastRetries = 0
    const tick = async (): Promise<void> => {
      try {
        const { image } = await getScreenPreview(callId, userId)
        if (cancelled) return
        if (image) {
          hasImage = true
          setSrc(previewDataUrl(image))
        }
      } catch (err) {
        if (cancelled) return
        // Parou de transmitir ou não posso mais ver: não insiste.
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
          setEnded(true)
          return
        }
      }
      const delay = previewPollDelay(hasImage, fastRetries)
      if (delay === PREVIEW_RETRY_MS) fastRetries++
      timer = setTimeout(() => void tick(), delay)
    }
    void tick()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [callId, userId])

  return { src, ended }
}

interface LiveStreamPreviewProps {
  userId: string
  name: string
  target: LiveTarget
  onWatch: () => void
}

/** Prévia ao vivo da transmissão no cartão de perfil, com "Entrar na transmissão". */
function LiveStreamPreview({
  userId,
  name,
  target,
  onWatch
}: LiveStreamPreviewProps): React.JSX.Element {
  const { src, ended } = useScreenPreview(target.callId, userId)

  return (
    <div className="mt-3 overflow-hidden rounded-lg bg-black/30">
      <div className="relative aspect-video w-full bg-black">
        {src ? (
          <img
            src={src}
            alt={`Prévia da transmissão de ${name}`}
            draggable={false}
            className="h-full w-full object-contain"
          />
        ) : ended ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
            Transmissão encerrada
          </div>
        ) : (
          <div role="status" aria-label="Carregando prévia…" className="h-full w-full">
            <Skeleton className="h-full w-full rounded-none" />
          </div>
        )}
        <span className="absolute left-2 top-2">
          <LiveBadge />
        </span>
      </div>
      <div className="p-2">
        <button
          type="button"
          onClick={onWatch}
          disabled={ended}
          className="w-full cursor-pointer rounded-md bg-[#248046] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1a6334] disabled:cursor-default disabled:opacity-60"
        >
          Entrar na transmissão
        </button>
      </div>
    </div>
  )
}

export default LiveStreamPreview
