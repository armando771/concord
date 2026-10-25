import { formatDuration, useElapsed } from './callUtils'

/**
 * Tempo da chamada do canal de voz (desde que a primeira pessoa entrou), ao
 * lado do nome do canal no sidebar.
 */
function VoiceChannelTimer({ startedAt }: { startedAt: string }): React.JSX.Element | null {
  const start = Date.parse(startedAt)
  const elapsed = useElapsed(Number.isNaN(start) ? null : start)
  if (Number.isNaN(start)) return null

  return (
    <span
      title="Tempo de chamada neste canal"
      className="shrink-0 font-mono text-[10px] font-semibold tabular-nums text-[#23a55a]"
    >
      {formatDuration(elapsed)}
    </span>
  )
}

export default VoiceChannelTimer
