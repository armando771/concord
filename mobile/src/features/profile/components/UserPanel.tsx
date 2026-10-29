import { StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, radius, spacing } from '../../../shared/theme/tokens'
import { Avatar } from '../../../shared/ui/Avatar'
import { IconButton } from '../../../shared/ui/IconButton'
import { useAuthStore } from '../../auth/store/authStore'
import { VoiceControls } from '../../voice/components/VoiceControls'

interface UserPanelProps {
  onOpenSettings: () => void
}

/** Painel de baixo: quem está logado, microfone, fone e engrenagem. */
export function UserPanel({ onOpenSettings }: UserPanelProps) {
  const user = useAuthStore((s) => s.user)
  return (
    <View style={styles.panel}>
      {user ? (
        <>
          <Avatar name={user.display_name} uri={user.avatar_url} size={36} />
          <View style={styles.names}>
            <Text style={styles.name} numberOfLines={1}>
              {user.display_name}
            </Text>
            <Text style={styles.username} numberOfLines={1}>
              @{user.username}
            </Text>
          </View>
        </>
      ) : (
        <View style={styles.names} />
      )}
      <VoiceControls />
      <IconButton icon="settings-sharp" label="Configurações" onPress={onOpenSettings} />
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.bgSurface, borderRadius: radius.lg, margin: spacing.sm },
  names: { flex: 1 },
  name: { color: colors.textStrong, fontSize: fontSize.md, fontWeight: '700' },
  username: { color: colors.textMuted, fontSize: fontSize.xs }
})
