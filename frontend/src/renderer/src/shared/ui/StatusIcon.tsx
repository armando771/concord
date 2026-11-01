import { useId } from 'react'
import { STATUS_META, type PresenceStatus } from '../../features/friends/lib/presenceStatus'

/**
 * Ícone do status como no Discord: bolinha (online), lua (ausente), bolinha
 * com traço (não perturbe) e anel (invisível/offline). Os recortes são
 * transparentes: mostram o fundo de quem desenha o ícone.
 */
function StatusIcon({
  status,
  size = 10,
  className = ''
}: {
  status: PresenceStatus
  size?: number
  className?: string
}): React.JSX.Element {
  const maskId = useId()
  const color = STATUS_META[status].color
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <mask id={maskId}>
        <circle cx="5" cy="5" r="5" fill="white" />
        {status === 'idle' && <circle cx="2.5" cy="2.5" r="3.75" fill="black" />}
        {status === 'dnd' && <rect x="2" y="4" width="6" height="2" rx="1" fill="black" />}
        {(status === 'invisible' || status === 'offline') && (
          <circle cx="5" cy="5" r="2.5" fill="black" />
        )}
      </mask>
      <circle cx="5" cy="5" r="5" style={{ fill: color }} mask={`url(#${maskId})`} />
    </svg>
  )
}

export default StatusIcon
