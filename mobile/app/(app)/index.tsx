import { useRouter } from 'expo-router'
import { callController } from '../../src/features/call/lib/callRuntime'
import { HomeScreen } from '../../src/features/servers/components/HomeScreen'

export default function HomeRoute() {
  const router = useRouter()
  return (
    <HomeScreen
      onOpenChannel={(channel) => router.push({ pathname: '/canal/[channelId]', params: { channelId: channel.id, name: channel.name, serverId: channel.server_id } })}
      onOpenConversation={({ id, title, type }) =>
        router.push({ pathname: '/dm/[conversationId]', params: { conversationId: id, name: title, type } })
      }
      onOpenFriends={() => router.push('/amigos')}
      onJoinVoice={(channel) => {
        void callController.joinChannel({ id: channel.id, name: channel.name, serverId: channel.server_id })
        router.push('/chamada')
      }}
      onOpenCall={() => router.push('/chamada')}
      onLeaveCall={() => void callController.leave()}
      onOpenSettings={() => router.push('/conta')}
    />
  )
}
