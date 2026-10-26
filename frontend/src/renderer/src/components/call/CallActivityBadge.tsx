import { activityOfPlayer } from '../../lib/activityState'
import { useActivityStore } from '../../store/activityStore'
import { ActivityGlyph } from './ActivityPickerPopover'

/**
 * Selo de quem está jogando a atividade da chamada (ícone do jogo + "Jogando
 * …" na dica). Só existe para quem está na chamada: o backend manda a lista de
 * jogadores só para os participantes.
 */
function CallActivityBadge({
  userId,
  className = 'h-4 w-4'
}: {
  userId: string
  className?: string
}): React.JSX.Element | null {
  const activity = useActivityStore((s) => activityOfPlayer(s, userId))
  if (!activity) return null
  const label = `Jogando ${activity.name}`
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="flex shrink-0 items-center"
      style={{ color: activity.accent }}
    >
      <ActivityGlyph activity={activity} className={className} />
    </span>
  )
}

export default CallActivityBadge
