import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChatScreen } from '../../../src/features/chat/components/ChatScreen'
import { useOpenProfile } from '../../../src/features/profile/hooks/useOpenProfile'

export default function ChannelRoute() {
  const router = useRouter()
  const openProfile = useOpenProfile()
  const { channelId, name, serverId } = useLocalSearchParams<{ channelId: string; name?: string; serverId?: string }>()
  return (
    <ChatScreen
      variant="channel"
      id={channelId}
      serverId={serverId}
      title={name ?? 'canal'}
      onOpenProfile={openProfile}
      onBack={() => router.back()}
    />
  )
}
