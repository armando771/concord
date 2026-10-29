import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChatScreen } from '../../../src/features/chat/components/ChatScreen'

export default function ConversationRoute() {
  const router = useRouter()
  const { conversationId, name, type } = useLocalSearchParams<{ conversationId: string; name?: string; type?: string }>()
  return (
    <ChatScreen
      variant={type === 'group' ? 'group' : 'dm'}
      id={conversationId}
      title={name ?? 'conversa'}
      onBack={() => router.back()}
    />
  )
}
