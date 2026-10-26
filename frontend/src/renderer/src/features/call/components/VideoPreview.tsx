/** Quadro 16:9 com a prévia da câmera (espelhada, como o Discord) ou o motivo de não haver. */
function VideoPreview({
  stream,
  loading = false,
  error,
  idle,
  className = ''
}: {
  stream: MediaStream | null
  loading?: boolean
  error?: string | null
  /** Texto quando a prévia está desligada. */
  idle?: string
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={`relative aspect-video w-full overflow-hidden rounded-xl bg-black ${className}`}
    >
      {stream && (
        <video
          ref={(el) => {
            if (el && el.srcObject !== stream) {
              el.srcObject = stream
              void el.play().catch(() => {})
            }
          }}
          muted
          playsInline
          aria-label="Prévia da câmera"
          className="h-full w-full -scale-x-100 object-cover"
        />
      )}
      {!stream && (
        <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-ds-sm text-gray-400">
          {error ?? (loading ? 'Abrindo a câmera…' : idle)}
        </p>
      )}
    </div>
  )
}

export default VideoPreview
