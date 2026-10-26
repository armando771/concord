import { useCallStore } from '../store/callStore'
import { boostRank } from '../../levels/lib/boost'
import StyleRank from '../../levels/components/StyleRank'
import { useMyBoostPercent } from '../../levels/hooks/useMyBoost'
import { formatDuration, useElapsed } from '../lib/callUtils'

/**
 * Por cima da chamada em que estou: a aura do boost (falando), o selo "Voz
 * conectada" com o tempo e o rank de estilo.
 */
function VoiceConnectedBadges(): React.JSX.Element {
  const startedAt = useCallStore((s) => s.startedAt)
  const paused = useCallStore((s) => s.muted || s.deafened)
  const boostPercent = useMyBoostPercent()
  const rank = boostRank(boostPercent)
  const elapsed = useElapsed(startedAt)
  return (
    <>
      {rank?.aura && !paused && (
        <span
          aria-hidden="true"
          className="boost-aura boost-motion pointer-events-none absolute inset-0 z-0"
          style={{ '--boost-color': `${rank.color}66` } as React.CSSProperties}
        />
      )}
      <div className="absolute right-4 top-3 z-10 flex items-center gap-2 rounded-full border border-success/30 bg-success/15 px-3 py-1 text-xs font-semibold text-success">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
        Voz conectada · {formatDuration(elapsed)}
      </div>
      {rank && (
        <div className="absolute left-4 top-3 z-10 rounded-xl border border-subtle bg-floating px-3 py-1.5 backdrop-blur">
          <StyleRank percent={boostPercent} paused={paused} size="md" />
        </div>
      )}
    </>
  )
}

export default VoiceConnectedBadges
