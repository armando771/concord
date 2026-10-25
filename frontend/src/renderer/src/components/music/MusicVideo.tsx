import { useEffect, useRef, useState } from 'react'
import { musicVideoUrl, setVideoWatching, type MusicItem } from '../../api/music'
import { ensureMediaToken } from '../../store/mediaToken'
import { useMusicStore } from '../../store/musicStore'
import { useMusicVideoSync } from './useMusicVideoSync'

/** Capa ou vídeo sincronizado da música atual, com fade de 600 ms na troca. */
function MusicVideo({
  serverId,
  item,
  startedAt,
  variant = 'panel'
}: {
  serverId: string
  item: MusicItem
  startedAt: number
  variant?: 'panel' | 'stage'
}): React.JSX.Element {
  const videoEnabled = useMusicStore((s) => s.videoEnabled)
  const stageVideo = useMusicStore((s) => s.stageVideo)
  const ref = useRef<HTMLVideoElement | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const watching = item.has_video && (variant === 'stage' ? stageVideo : videoEnabled)

  // Avisa o backend: só baixa o vídeo se alguém está vendo.
  useEffect(() => {
    if (!watching) return
    void setVideoWatching(serverId, true).catch(() => {})
    return () => {
      void setVideoWatching(serverId, false).catch(() => {})
    }
  }, [serverId, watching])

  useEffect(() => {
    if (!watching || !item.video_ready) return
    let alive = true
    void ensureMediaToken().then((t) => {
      if (alive) setToken(t)
    })
    return () => {
      alive = false
    }
  }, [item.video_ready, watching])

  const src = watching && item.video_ready && token ? musicVideoUrl(item.id, token) : null
  const loaded = src !== null && loadedSrc === src

  useMusicVideoSync(ref, src ? startedAt : null)

  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-black ${variant === 'stage' ? 'h-full w-full' : 'aspect-video w-full'}`}
    >
      <img src={item.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" />
      {src && (
        <video
          key={item.id}
          ref={ref}
          src={src}
          muted
          playsInline
          autoPlay
          onLoadedData={() => setLoadedSrc(src)}
          className={`absolute inset-0 h-full w-full bg-black object-contain transition-opacity duration-[600ms] ease-out ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  )
}

export default MusicVideo
