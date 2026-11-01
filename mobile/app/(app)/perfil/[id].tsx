import { useLocalSearchParams, useRouter } from 'expo-router'
import { ProfileScreen } from '../../../src/features/profile/components/ProfileScreen'

export default function ProfileRoute() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ProfileScreen userId={id} onBack={() => router.back()} />
}
