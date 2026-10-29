import { StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, spacing } from '../../../shared/theme/tokens'
import { Button } from '../../../shared/ui/Button'
import { callController } from '../../call/lib/callRuntime'
import { pushRegistration } from '../../notifications/lib/pushSession'
import { logout as logoutRequest } from '../api/auth'
import { useAuthStore } from '../store/authStore'

interface AccountPanelProps {
  logout?: () => Promise<void>
  /** Tira o aparelho do push desta conta; precisa rodar antes de a sessão acabar. */
  forgetPush?: () => Promise<void>
  /** Sai da chamada em andamento; também precisa rodar antes de a sessão acabar. */
  leaveCall?: () => Promise<void>
}

/** Aba "Você" por enquanto: quem está logado e o botão Sair. */
export function AccountPanel({ logout = logoutRequest, forgetPush = pushRegistration.forget, leaveCall = callController.leave }: AccountPanelProps) {
  const user = useAuthStore((s) => s.user)

  async function signOut(): Promise<void> {
    await leaveCall().catch(() => {})
    await forgetPush().catch(() => {})
    // Avisa o servidor, mas sair do aparelho não depende dele estar no ar.
    await logout().catch(() => {})
    await useAuthStore.getState().signOut()
  }

  return (
    <View style={styles.panel}>
      {user ? (
        <View>
          <Text style={styles.name}>{user.display_name}</Text>
          <Text style={styles.username}>@{user.username}</Text>
        </View>
      ) : null}
      <Button title="Sair" variant="danger" onPress={signOut} />
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { flex: 1, gap: spacing.xl, padding: spacing.xl, backgroundColor: colors.bgPrimary },
  name: { color: colors.textStrong, fontSize: fontSize.xl, fontWeight: '700' },
  username: { color: colors.textMuted, fontSize: fontSize.md }
})
