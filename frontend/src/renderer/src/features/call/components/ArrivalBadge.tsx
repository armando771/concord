import { useRecentArrival } from '../hooks/useRecentArrival'
import { useCallStore } from '../store/callStore'

/**
 * Pílula verde "Chegou": a pessoa acabou de entrar nesse canal de voz. Some
 * sozinha em ~5 s (o store a tira; o fade-out é CSS, ver `.arrival-badge`).
 */
function ArrivalBadge({
  channelId,
  userId
}: {
  channelId: string | null | undefined
  userId: string
}): React.JSX.Element | null {
  if (!useRecentArrival(channelId, userId)) return null
  return (
    <span className="arrival-badge shrink-0 rounded-full bg-success-strong px-1.5 text-[9px] font-bold leading-4 text-white">
      Chegou
    </span>
  )
}

/** O mesmo selo para o tile da pessoa na tela da call (o canal é o da minha call). */
export function CallArrivalBadge({ userId }: { userId: string }): React.JSX.Element | null {
  const channelId = useCallStore((s) => (s.type === 'channel' ? s.channelId : null))
  return <ArrivalBadge channelId={channelId} userId={userId} />
}

export default ArrivalBadge
