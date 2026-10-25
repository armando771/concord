import { HeadsetOffIcon, MicOffIcon } from '../icons'

/**
 * Ícones de mudo/ensurdecido ao lado do nome (como no Discord). Os impostos por
 * um moderador (silenciar/ensurdecer no servidor) aparecem com outra dica.
 */
function VoiceStateIcons({
  muted,
  deafened,
  serverMuted,
  serverDeafened,
  className = 'h-3.5 w-3.5'
}: {
  muted?: boolean
  deafened?: boolean
  serverMuted?: boolean
  serverDeafened?: boolean
  className?: string
}): React.JSX.Element | null {
  const showMic = muted || deafened || serverMuted || serverDeafened
  const showHeadset = deafened || serverDeafened
  if (!showMic) return null
  const byServer = serverMuted || serverDeafened
  const title = byServer
    ? serverDeafened
      ? 'Ensurdecido por um moderador'
      : 'Silenciado por um moderador'
    : deafened
      ? 'Áudio e microfone desativados'
      : 'Microfone desativado'
  return (
    <span className="flex shrink-0 items-center gap-0.5 text-red-400" title={title}>
      <MicOffIcon className={className} />
      {showHeadset && <HeadsetOffIcon className={className} />}
    </span>
  )
}

export default VoiceStateIcons
