import { useRouter } from 'expo-router'
import { ForgotPasswordForm } from '../../src/features/auth/components/ForgotPasswordForm'
import { Screen } from '../../src/shared/ui/Screen'

export default function ForgotPasswordRoute() {
  const router = useRouter()
  return (
    <Screen>
      <ForgotPasswordForm onBack={() => router.back()} />
    </Screen>
  )
}
