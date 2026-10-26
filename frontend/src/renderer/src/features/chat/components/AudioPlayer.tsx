import { useEffect, useRef, useState } from 'react'
import type { Attachment } from '../api/messages'
import { formatDuration, playableDuration } from '../lib/attachments'
import { PauseIcon, PlayIcon } from '../../../shared/ui/icons'
import { useMediaSrc } from '../hooks/useMediaSrc'

/** Player de áudio inline. Nada é baixado até o primeiro play. */
function AudioPlayer({ attachment }: { attachment: Attachment }): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [activated, setActivated] = useState(false)
  const { src, onError, failed } = useMediaSrc(attachment.id, activated, attachment.url)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [elementDuration, setElementDuration] = useState(NaN)
  // Tocar assim que a URL chegar; e retomar do mesmo ponto se precisou de
  // token novo no meio.
  const playWhenReady = useRef(false)
  const resumeAt = useRef(0)

  const total = playableDuration(elementDuration, attachment.duration_ms)
  const fraction = total ? Math.min(1, current / total) : 0

  useEffect(() => {
    const el = audioRef.current
    if (!src || !el || !playWhenReady.current) return
    playWhenReady.current = false
    el.play().catch(() => {})
  }, [src])

  const toggle = (): void => {
    const el = audioRef.current
    if (!activated || !src || !el) {
      playWhenReady.current = true
      setActivated(true)
      return
    }
    if (el.paused) el.play().catch(() => {})
    else el.pause()
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>): void => {
    const el = audioRef.current
    // Gravação webm sem duração conhecida não deixa pular.
    if (!el || !Number.isFinite(el.duration)) return
    const rect = e.currentTarget.getBoundingClientRect()
    el.currentTime = ((e.clientX - rect.left) / rect.width) * el.duration
  }

  const handleError = (): void => {
    const el = audioRef.current
    if (el && el.currentTime > 0) {
      resumeAt.current = el.currentTime
      playWhenReady.current = !el.paused || playing
    }
    onError()
  }

  return (
    <div className="max-w-md">
      <div className="flex items-center gap-3 rounded-lg border border-subtle bg-fg/5 px-3 py-2">
        <button
          type="button"
          onClick={toggle}
          disabled={failed}
          aria-label={playing ? 'Pausar' : 'Tocar'}
          title={playing ? 'Pausar' : 'Tocar'}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {playing ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
        </button>
        <div
          onClick={seek}
          className="relative h-1.5 min-w-0 flex-1 cursor-pointer rounded-full bg-fg/10"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-violet-400"
            style={{ width: `${fraction * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-gray-300">
          {failed
            ? 'Indisponível'
            : `${formatDuration(current * 1000)} / ${total ? formatDuration(total * 1000) : '--:--'}`}
        </span>
        <audio
          ref={audioRef}
          src={src ?? undefined}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onDurationChange={(e) => setElementDuration(e.currentTarget.duration)}
          onLoadedMetadata={(e) => {
            const el = e.currentTarget
            setElementDuration(el.duration)
            if (resumeAt.current > 0 && Number.isFinite(el.duration)) {
              el.currentTime = resumeAt.current
              resumeAt.current = 0
            }
          }}
          onError={handleError}
        />
      </div>
      <p className="mt-0.5 truncate text-[11px] text-gray-400">{attachment.filename}</p>
    </div>
  )
}

export default AudioPlayer
