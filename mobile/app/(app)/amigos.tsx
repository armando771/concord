import { useRouter } from 'expo-router'
import { FriendsScreen } from '../../src/features/friends/components/FriendsScreen'

export default function FriendsRoute() {
  const router = useRouter()
  return (
    <FriendsScreen
      onBack={() => router.back()}
      onOpenConversation={({ id, title, type }) =>
        router.push({ pathname: '/dm/[conversationId]', params: { conversationId: id, name: title, type } })
      }
    />
  )
}
