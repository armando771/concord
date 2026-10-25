import { activityLine } from '../lib/presenceActivity'
import { useActivity, useInVoice } from '../store/presenceActivityStore'
import { GamepadIcon, VolumeIcon } from './icons'

/** Só o jogo (ícone + nome); nada se a pessoa não está jogando. */
export function GameLine({
  userId,
  className = ''
}: {
  userId: string
  className?: string
}): React.JSX.Element | null {
  const activity = useActivity(userId)
  if (!activity) return null
  return (
    <span className={`flex min-w-0 items-center gap-1 ${className}`} title={activity.name}>
      <GamepadIcon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{activity.name}</span>
    </span>
  )
}

/**
 * Linha embaixo do nome: o jogo (ícone de controle), "Em voz", a nota ou o
 * status, nessa ordem de prioridade. `fallback` é o que mostrar sem nenhuma
 * atividade (o status ou a nota de antes).
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
  const inVoice = useInVoice(userId)
  const line = activityLine({ activity, inVoice, note, statusLabel })
  return (
    <span className={`flex min-w-0 items-center gap-1 ${className}`} title={line.text}>
      {line.kind === 'game' && <GamepadIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
      {line.kind === 'voice' && <VolumeIcon className="h-3.5 w-3.5 shrink-0 text-[#23a55a]" />}
      <span className={`truncate ${line.kind === 'voice' ? 'text-[#23a55a]' : ''}`}>
        {line.text}
      </span>
    </span>
  )
}
