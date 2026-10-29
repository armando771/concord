import { useRouter } from 'expo-router'
import { RegisterForm } from '../../src/features/auth/components/RegisterForm'
import { Screen } from '../../src/shared/ui/Screen'

export default function RegisterRoute() {
  const router = useRouter()
  return (
    <Screen>
      <RegisterForm onLogin={() => router.back()} />
    </Screen>
  )
}
