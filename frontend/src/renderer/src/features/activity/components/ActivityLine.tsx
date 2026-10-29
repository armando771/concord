import { activityLine, type ActivityLineKind, type PresenceActivity } from '../lib/presenceActivity'
import { listeningSummary, type ListeningActivity } from '../lib/listeningActivity'
import { useActivity, useInVoice } from '../store/presenceActivityStore'
import { useListening } from '../store/listeningStore'
import { VolumeIcon } from '../../../shared/ui/icons'
import GameIcon from './GameIcon'
import MusicIcon from './MusicIcon'

function ActivityGameIcon({
  activity,
  className
}: {
  activity: PresenceActivity
  className: string
}): React.JSX.Element {
  return (
    <GameIcon
      name={activity.name}
      appId={activity.app_id}
      iconHash={activity.icon_hash}
      className={className}
    />
  )
}

/**
 * Linha curta só da atividade (jogo; sem jogo, "Ouvindo <música>"); nada se a
 * pessoa não está fazendo nenhum dos dois. Para a lista de DMs.
 */
export function CompactActivityLine({
  userId,
  className = ''
}: {
  userId: string
  className?: string
}): React.JSX.Element | null {
  const activity = useActivity(userId)
  const listening = useListening(userId)
  if (activity) {
    return (
      <span className={`flex min-w-0 items-center gap-1 ${className}`} title={activity.name}>
        <ActivityGameIcon activity={activity} className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{activity.name}</span>
      </span>
    )
  }
  if (!listening) return null
  return (
    <span
      className={`flex min-w-0 items-center gap-1 ${className}`}
      title={listeningSummary(listening)}
    >
      <MusicIcon app={listening.app} className="h-3.5 w-3.5" />
      <span className="truncate">Ouvindo {listening.title}</span>
    </span>
  )
}

/** Só o ícone do jogo (com o nome na dica), para linhas apertadas como a de quem está em voz. */
export function GameBadge({ userId }: { userId: string }): React.JSX.Element | null {
  const activity = useActivity(userId)
  if (!activity) return null
  return (
    <span title={`Jogando ${activity.name}`} className="flex shrink-0 items-center">
      <ActivityGameIcon activity={activity} className="h-4 w-4" />
    </span>
  )
}

function LineIcon({
  kind,
  activity,
  listening
}: {
  kind: ActivityLineKind
  activity: PresenceActivity | null
  listening: ListeningActivity | null
}): React.JSX.Element | null {
  if (kind === 'game' && activity) {
    return <ActivityGameIcon activity={activity} className="h-3.5 w-3.5 shrink-0" />
  }
  if (kind === 'listening' && listening)
    return <MusicIcon app={listening.app} className="h-3.5 w-3.5" />
  if (kind === 'voice') return <VolumeIcon className="h-3.5 w-3.5 shrink-0 text-success" />
  return null
}

/**
 * Linha embaixo do nome: o jogo (ícone de controle), a música, "Em voz", a nota
 * ou o status, nessa ordem de prioridade. `statusLabel` é o que mostrar sem
 * nenhuma atividade (o status ou o @ de antes).
 */
export function ActivityLine({
  userId,
  note,
  statusLabel,
  className = ''
}: {
  userId: string
  note?: string | null
  statusLabel: string
  className?: string
}): React.JSX.Element {
  const activity = useActivity(userId)
  const listening = useListening(userId)
  const inVoice = useInVoice(userId)
  const line = activityLine({ activity, listening, inVoice, note, statusLabel })
  const title = line.kind === 'listening' && listening ? listeningSummary(listening) : line.text
  return (
    <span className={`flex min-w-0 items-center gap-1 ${className}`} title={title}>
      <LineIcon kind={line.kind} activity={activity} listening={listening} />
      <span className={`truncate ${line.kind === 'voice' ? 'text-success' : ''}`}>{line.text}</span>
    </span>
  )
}
