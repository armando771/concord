import { VolumeIcon } from '../../../shared/ui/icons'

/** Alto-falante ao lado do nome: a mensagem veio do /tts (lida em voz em call). */
function TTSBadge({ show }: { show?: boolean }): React.JSX.Element | null {
  if (!show) return null
  return (
    <span
      className="flex items-center self-center text-gray-500"
      title="Mensagem TTS: lida em voz para quem estava em call"
      aria-label="Mensagem TTS"
    >
      <VolumeIcon className="h-3.5 w-3.5" />
    </span>
  )
}

export default TTSBadge
