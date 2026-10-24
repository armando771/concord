import { HeadsetOffIcon, MicOffIcon } from '../icons'

/** Ícones de mudo/ensurdecido ao lado do nome (como no Discord). */
function VoiceStateIcons({
  muted,
  deafened,
  className = 'h-3.5 w-3.5'
}: {
  muted?: boolean
  deafened?: boolean
  className?: string
}): React.JSX.Element | null {
  if (!muted && !deafened) return null
  return (
    <span
      className="flex shrink-0 items-center gap-0.5 text-red-400"
      title={deafened ? 'Áudio e microfone desativados' : 'Microfone desativado'}
    >
      <MicOffIcon className={className} />
      {deafened && <HeadsetOffIcon className={className} />}
    </span>
  )
}

export default VoiceStateIcons
