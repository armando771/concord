import { useNow } from '../../../shared/hooks/useNow'
import { trackProgress } from '../lib/listeningActivity'

/**
 * "1:23 ━━━━──── 3:45": o tempo anda sozinho a cada segundo (o servidor só
 * manda o início e a duração). Sem duração, só o tempo decorrido.
 */
function TrackProgress({
  startedAt,
  durationMs
}: {
  startedAt: number
  durationMs?: number
}): React.JSX.Element {
  const now = useNow(1000)
  const progress = trackProgress(startedAt, durationMs, now)
  if (progress.ratio === null) {
    return <p className="mt-2 text-ds-xs tabular-nums text-gray-400">{progress.elapsed}</p>
  }
  const percent = Math.round(progress.ratio * 100)
  return (
    <div className="mt-2 flex items-center gap-2 text-ds-xs tabular-nums text-gray-400">
      <span>{progress.elapsed}</span>
      <div
        role="progressbar"
        aria-label="Progresso da música"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${progress.elapsed} de ${progress.total}`}
        className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-fg/15"
      >
        <div
          className="h-full rounded-full bg-gray-200"
          style={{ width: `${progress.ratio * 100}%` }}
        />
      </div>
      <span>{progress.total}</span>
    </div>
  )
}

export default TrackProgress
