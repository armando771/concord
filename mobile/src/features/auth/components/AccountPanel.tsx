import { ScrollView, StyleSheet } from 'react-native'
import { colors, spacing } from '../../../shared/theme/tokens'
import { Button } from '../../../shared/ui/Button'
import { callController } from '../../call/lib/callRuntime'
import { pushRegistration } from '../../notifications/lib/pushSession'
import { ProfileCard } from '../../profile/components/card/ProfileCard'
import { useCardPresence } from '../../profile/hooks/useCardPresence'
import { logout as logoutRequest } from '../api/auth'
import { useAuthStore } from '../store/authStore'

interface AccountPanelProps {
  logout?: () => Promise<void>
  /** Tira o aparelho do push desta conta; precisa rodar antes de a sessão acabar. */
  forgetPush?: () => Promise<void>
  /** Sai da chamada em andamento; também precisa rodar antes de a sessão acabar. */
  leaveCall?: () => Promise<void>
}

/** Aba "Você": o cartão do próprio perfil e o botão Sair. */
export function AccountPanel({ logout = logoutRequest, forgetPush = pushRegistration.forget, leaveCall = callController.leave }: AccountPanelProps) {
  const user = useAuthStore((s) => s.user)
  const presence = useCardPresence(user?.id ?? '')

  async function signOut(): Promise<void> {
    await leaveCall().catch(() => {})
    await forgetPush().catch(() => {})
    // Avisa o servidor, mas sair do aparelho não depende dele estar no ar.
    await logout().catch(() => {})
    await useAuthStore.getState().signOut()
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.panel}>
      {user ? <ProfileCard profile={user} status={presence} /> : null}
      <Button title="Sair" variant="danger" onPress={signOut} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bgPrimary },
  panel: { gap: spacing.xl, padding: spacing.xl }
})
