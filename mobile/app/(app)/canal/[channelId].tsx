import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChatScreen } from '../../../src/features/chat/components/ChatScreen'

export default function ChannelRoute() {
  const router = useRouter()
  const { channelId, name, serverId } = useLocalSearchParams<{ channelId: string; name?: string; serverId?: string }>()
  return <ChatScreen variant="channel" id={channelId} serverId={serverId} title={name ?? 'canal'} onBack={() => router.back()} />
}
