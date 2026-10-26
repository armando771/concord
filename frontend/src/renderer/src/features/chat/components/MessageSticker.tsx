import { useEffect, useState } from 'react'
import { stickerFileUrl } from '../api/stickers'
import { ensureMediaToken } from '../store/mediaToken'

interface MessageStickerProps {
  sticker: {
    id: string
    server_id: string
    name: string
    content_type: string
  }
}

export default function MessageSticker({ sticker }: MessageStickerProps): React.JSX.Element {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    ensureMediaToken()
      .then((token) => {
        if (!cancelled) {
          setSrc(stickerFileUrl(sticker.id, token))
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [sticker.id])

  if (failed) {
    return (
      <div className="my-1 flex h-28 w-28 items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/5 p-2 text-center text-xs text-gray-500">
        Figurinha indisponível
      </div>
    )
  }

  return (
    <div
      className="group relative my-1 inline-block select-none"
      title={`:${sticker.name}:`}
    >
      {src ? (
        <img
          src={src}
          alt={sticker.name}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="h-36 w-36 object-contain transition-transform duration-150 hover:scale-105"
        />
      ) : (
        <div className="h-36 w-36 animate-pulse rounded-lg bg-white/5" />
      )}
      <span className="pointer-events-none absolute -bottom-5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
        :{sticker.name}:
      </span>
    </div>
  )
}
