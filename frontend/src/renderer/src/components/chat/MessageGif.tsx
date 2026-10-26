import { useState } from 'react'

interface MessageGifProps {
  gifUrl: string
  metadata?: {
    width?: number
    height?: number
    preview_url?: string
  } | null
}

export default function MessageGif({ gifUrl, metadata }: MessageGifProps): React.JSX.Element {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="my-1 flex h-32 w-48 items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/5 p-2 text-center text-xs text-gray-500">
        GIF indisponível
      </div>
    )
  }

  const maxWidth = 300
  const maxHeight = 300

  let widthStyle: number | undefined
  let heightStyle: number | undefined

  if (metadata?.width && metadata?.height) {
    const ratio = metadata.width / metadata.height
    if (ratio > 1) {
      widthStyle = Math.min(metadata.width, maxWidth)
      heightStyle = Math.round(widthStyle / ratio)
    } else {
      heightStyle = Math.min(metadata.height, maxHeight)
      widthStyle = Math.round(heightStyle * ratio)
    }
  }

  return (
    <div
      className="relative my-1 inline-block overflow-hidden rounded-xl bg-black/30 select-none"
      style={{
        maxWidth: maxWidth,
        maxHeight: maxHeight,
        width: widthStyle,
        height: heightStyle
      }}
    >
      <img
        src={gifUrl}
        alt="GIF"
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
        className="h-full w-full rounded-xl object-cover"
      />
      <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase backdrop-blur-md">
        GIF
      </span>
    </div>
  )
}
