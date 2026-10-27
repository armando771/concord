import { activityOfPlayer } from '../../activity/lib/activityState'
import { useActivityStore } from '../../activity/store/activityStore'
import { CallArrivalBadge } from './ArrivalBadge'
import { ActivityGlyph } from './ActivityPickerPopover'

/**
 * Selos de estado da pessoa na chamada, ao lado do nome no tile: "Chegou"
 * (entrou agora) e o ícone do jogo da atividade ("Jogando …" na dica). A
 * atividade só existe para quem está na chamada: o backend manda a lista de
 * jogadores só para os participantes.
 *
 * `arrival={false}`: sem o "Chegou" (a lista do canal de voz já mostra o seu).
 */
function CallActivityBadge({
  userId,
  className = 'h-4 w-4',
  arrival = true
}: {
  userId: string
  className?: string
  arrival?: boolean
}): React.JSX.Element | null {
  const activity = useActivityStore((s) => activityOfPlayer(s, userId))
  const label = activity ? `Jogando ${activity.name}` : undefined
  return (
    <>
      {arrival && <CallArrivalBadge userId={userId} />}
      {activity && (
        <span
          role="img"
          aria-label={label}
          title={label}
          className="flex shrink-0 items-center"
          style={{ color: activity.accent }}
        >
          <ActivityGlyph activity={activity} className={className} />
        </span>
      )}
    </>
  )
}

export default CallActivityBadge
