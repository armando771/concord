import { useParams } from 'react-router-dom'
import { useCallStore } from '../store/callStore'
import MusicPanel from '../../music/components/MusicPanel'
import { useVoiceChannelMusic } from '../../music/hooks/useVoiceChannelMusic'
import { isConnectedTo } from '../../servers/lib/voiceChannelRow'
import CallControlsDock from './CallControlsDock'
import CallStage from './CallStage'
import VoiceConnectedBadges from './VoiceConnectedBadges'
import VoiceLobby from './VoiceLobby'
import useSpeaking from '../hooks/useSpeaking'
import VoiceChatToggle from '../../chat/components/VoiceChatToggle'
import GuestInviteEntry from '../../guests/components/GuestInviteEntry'

/** O palco da chamada em que estou (quem fala acende). */
function ConnectedStage({ serverId }: { serverId?: string }): React.JSX.Element {
  const speaking = useSpeaking()
  return <CallStage speaking={speaking} serverId={serverId} />
}

/**
 * A tela do canal de voz: a chamada (conectado) ou quem está nela e o botão de
 * entrar. O botão do chat abre o chat do canal, que a tela do servidor põe na
 * coluna da direita (ServerViewLayout).
 */
function VoiceChannelView({ channelId }: { channelId: string }): React.JSX.Element {
  const { id: serverId } = useParams<{ id: string }>()
  const connectedHere = useCallStore((s) => isConnectedTo(s, channelId))
  useVoiceChannelMusic(connectedHere, serverId)

  return (
    <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
      {connectedHere && <VoiceConnectedBadges />}
      <div className="absolute right-4 top-3 z-20 flex items-center gap-2">
        {connectedHere && <GuestInviteEntry channelId={channelId} />}
        <VoiceChatToggle channelId={channelId} />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
          {connectedHere ? (
            <ConnectedStage serverId={serverId} />
          ) : (
            <VoiceLobby channelId={channelId} serverId={serverId} />
          )}
        </div>
      </div>
      {connectedHere && serverId && <MusicPanel serverId={serverId} />}

      {connectedHere && <CallControlsDock />}
    </div>
  )
}

export default VoiceChannelView
