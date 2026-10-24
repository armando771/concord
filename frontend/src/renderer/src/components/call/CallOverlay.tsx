import { useCallStore } from '../../store/callStore'
import RemoteAudio from './RemoteAudio'

/**
 * Host global dos <audio> remotos. A UI das chamadas vive nas views
 * (VoiceChannelView para canais, DmCallView para DMs) — aqui só mantemos
 * os elementos de áudio montados para o som não cortar ao navegar.
 */
function CallOverlay(): React.JSX.Element | null {
  const status = useCallStore((s) => s.status)
  const streams = useCallStore((s) => s.streams)
  const screenAudioStreams = useCallStore((s) => s.screenAudioStreams)
  const deafened = useCallStore((s) => s.deafened)

  if (status === 'idle' || status === 'ringing') return null

  return (
    <>
      {Object.entries(streams).map(([userId, stream]) => (
        <RemoteAudio key={userId} stream={stream} muted={deafened} userId={userId} />
      ))}
      {/* Som das telas compartilhadas (jogo, vídeo…) — também segue o ensurdecer. */}
      {Object.entries(screenAudioStreams).map(([userId, stream]) => (
        <RemoteAudio key={`screen:${userId}`} stream={stream} muted={deafened} />
      ))}
    </>
  )
}

export default CallOverlay
