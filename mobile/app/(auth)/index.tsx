import { useRouter } from 'expo-router'
import { LoginForm } from '../../src/features/auth/components/LoginForm'
import { Screen } from '../../src/shared/ui/Screen'

export default function LoginRoute() {
  const router = useRouter()
  return (
    <Screen>
      <LoginForm
        onRegister={() => router.push('/cadastro')}
        onForgotPassword={() => router.push('/recuperar-senha')}
      />
    </Screen>
  )
}
