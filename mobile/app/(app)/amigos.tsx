import { useRouter } from 'expo-router'
import { FriendsScreen } from '../../src/features/friends/components/FriendsScreen'
import { useOpenProfile } from '../../src/features/profile/hooks/useOpenProfile'

export default function FriendsRoute() {
  const router = useRouter()
  const openProfile = useOpenProfile()
  return (
    <FriendsScreen
      onBack={() => router.back()}
      onOpenProfile={openProfile}
      onOpenConversation={({ id, title, type }) =>
        router.push({ pathname: '/dm/[conversationId]', params: { conversationId: id, name: title, type } })
      }
    />
  )
}
