import { useEffect, useRef } from 'react'
import LiveVideoExtras from './LiveVideoExtras'

/** O <video> de uma câmera ou live, preenchendo o tile (o pai é `relative`). */
export default function VideoFill({
  stream,
  fit,
  mirror,
  square,
  onAspect
}: {
  stream: MediaStream
  fit: 'cover' | 'contain'
  mirror?: boolean
  /** Sem cantos arredondados (tela cheia). */
  square?: boolean
  /** Proporção (largura/altura) do vídeo assim que ela é conhecida/muda. */
  onAspect?: (aspect: number) => void
}): React.JSX.Element {
  const ref = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    void el.play().catch(() => {})
  }, [stream])

  useEffect(() => {
    const el = ref.current
    if (!el || !onAspect) return
    const report = (): void => {
      if (el.videoWidth > 0 && el.videoHeight > 0) onAspect(el.videoWidth / el.videoHeight)
    }
    el.addEventListener('loadedmetadata', report)
    el.addEventListener('resize', report)
    report()
    return () => {
      el.removeEventListener('loadedmetadata', report)
      el.removeEventListener('resize', report)
    }
  }, [onAspect])

  return (
    <>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 h-full w-full ${square ? '' : 'rounded-2xl'} ${
          fit === 'contain' ? 'bg-black object-contain' : 'object-cover'
        } ${mirror ? '-scale-x-100' : ''}`}
      />
      <LiveVideoExtras stream={stream} videoRef={ref} />
    </>
  )
}
