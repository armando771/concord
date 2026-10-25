import { useCallStore } from '../../store/callStore'
import RemoteAudio from './RemoteAudio'
import { remoteAudioEntries } from './remoteAudioEntries'

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

  // Vozes seguem o ensurdecer; o som das telas (jogo, vídeo…) não.
  return (
    <>
      {remoteAudioEntries({ streams, screenAudioStreams, deafened }).map((e) => (
        <RemoteAudio key={e.key} stream={e.stream} muted={e.muted} userId={e.volumeKey} />
      ))}
    </>
  )
}

export default CallOverlay
