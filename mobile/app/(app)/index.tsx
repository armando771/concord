import { useRouter } from 'expo-router'
import { HomeScreen } from '../../src/features/servers/components/HomeScreen'

export default function HomeRoute() {
  const router = useRouter()
  return (
    <HomeScreen
      onOpenChannel={(channel) => router.push({ pathname: '/canal/[channelId]', params: { channelId: channel.id, name: channel.name } })}
      onOpenConversation={({ id, title, type }) =>
        router.push({ pathname: '/dm/[conversationId]', params: { conversationId: id, name: title, type } })
      }
      onOpenSettings={() => router.push('/conta')}
    />
  )
}
