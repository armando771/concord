import ChatPane from '../../chat/components/ChatPane'
import VoiceChannelView from '../../call/components/VoiceChannelView'
import { useServerMentionable } from '../hooks/useServerMentionable'
import type { ChatPermissions } from '../../chat/lib/chatPermissions'
import type { Channel } from '../api/channels'
import type { Server } from '../api/servers'

interface ServerChannelContentProps {
  server: Server
  channelId: string | undefined
  channel: Channel | undefined
  permissions: ChatPermissions
}

/** Boas-vindas do servidor sem canal aberto. */
function ServerWelcome({ name }: { name: string }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col justify-between overflow-y-auto p-6">
      <div className="my-auto max-w-lg space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-600/30 border border-violet-500/40 text-violet-300 font-bold text-2xl shadow-lg">
          #
        </div>
        <h1 className="text-ds-xxl font-bold text-strong">Bem-vindo a #{name}!</h1>
        <p className="text-ds-md text-gray-400">
          Este é o início do servidor <strong className="text-strong">{name}</strong>. Convide seus
          amigos e comece a conversar!
        </p>
      </div>
    </div>
  )
}

/** O meio da tela do servidor: a chamada (canal de voz), o chat (texto) ou as boas-vindas. */
function ServerChannelContent({
  server,
  channelId,
  channel,
  permissions
}: ServerChannelContentProps): React.JSX.Element {
  const mentionable = useServerMentionable()
  if (!channelId) return <ServerWelcome name={server.name} />
  if (channel?.type === 'voice') return <VoiceChannelView channelId={channelId} />
  return (
    <ChatPane
      room={`channel:${channelId}`}
      serverId={server.id}
      placeholder={`Mensagem para #${channel?.name ?? 'canal'}`}
      canMentionEveryone={permissions.canMentionEveryone}
      permissions={permissions}
      canDeleteMessages={!channel?.is_system}
      mentionable={mentionable}
    />
  )
}

export default ServerChannelContent
