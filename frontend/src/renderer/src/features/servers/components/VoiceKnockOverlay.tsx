import { useCallStore } from '../../call/store/callStore'
import { knockView } from '../lib/voiceChannelRow'
import { LockIcon, XIcon } from '../../../shared/ui/icons'

interface VoiceKnockOverlayProps {
  channelId: string
  locked: boolean
  connectedHere: boolean
  /** Pedir para entrar (o mesmo clique do canal). */
  onJoin: () => void
}

/** Sala trancada e eu fora dela: pedir para entrar, pedido enviado ou recusado. */
function VoiceKnockOverlay({
  channelId,
  locked,
  connectedHere,
  onJoin
}: VoiceKnockOverlayProps): React.JSX.Element | null {
  const knock = useCallStore((s) => knockView(s.knock, channelId))
  const cancelJoinRequest = useCallStore((s) => s.cancelJoinRequest)
  if (!locked || connectedHere) return null
  if (knock === 'pending') {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-between rounded-lg bg-amber-950/80 px-2.5 backdrop-blur-sm border border-amber-500/40 animate-in fade-in duration-150">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="h-2 w-2 shrink-0 animate-ping rounded-full bg-amber-400" />
          <span className="truncate text-xs font-semibold text-amber-200">Pedido enviado...</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            cancelJoinRequest()
          }}
          title="Cancelar pedido"
          className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-fg/10 text-gray-300 hover:bg-fg/20 hover:text-strong"
        >
          <XIcon className="h-3 w-3" />
        </button>
      </div>
    )
  }
  if (knock === 'declined') {
    return (
      <div className="absolute inset-0 z-10 flex items-center gap-1.5 rounded-lg bg-red-950/80 px-2.5 backdrop-blur-sm border border-red-500/40 animate-in fade-in duration-150">
        <XIcon className="h-3.5 w-3.5 text-red-400 shrink-0" />
        <span className="truncate text-xs font-medium text-red-200">Pedido recusado</span>
      </div>
    )
  }
  return (
    <div
      onClick={onJoin}
      className="pointer-events-none group-hover/voicech:pointer-events-auto absolute inset-0 z-10 flex items-center justify-center gap-1.5 rounded-lg bg-black/80 px-2 opacity-0 backdrop-blur-xs transition-opacity group-hover/voicech:opacity-100 cursor-pointer border border-amber-500/20 on-media"
    >
      <LockIcon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
      <span className="truncate text-xs font-semibold text-amber-200">
        Sala trancada · Pedir permissão
      </span>
    </div>
  )
}

export default VoiceKnockOverlay
