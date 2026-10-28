import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChatScreen } from '../../../src/features/chat/components/ChatScreen'

export default function ChannelRoute() {
  const router = useRouter()
  const { channelId, name } = useLocalSearchParams<{ channelId: string; name?: string }>()
  return <ChatScreen variant="channel" id={channelId} title={name ?? 'canal'} onBack={() => router.back()} />
}
