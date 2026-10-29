import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '../../../shared/theme/tokens'
import { Avatar } from '../../../shared/ui/Avatar'
import type { PresenceStatus } from '../lib/presenceStatus'
import { PresenceDot } from './PresenceDot'

export interface RowAction {
  label: string
  onPress: () => void
  danger?: boolean
}

interface FriendRowProps {
  name: string
  subtitle?: string
  avatarUri?: string | null
  /** Bolinha de presença (só nas listas de amigos). */
  presence?: PresenceStatus
  actions: RowAction[]
}

/** Linha de uma pessoa nas listas de amigos, com os botões de ação (cada um com o nome para o leitor de tela). */
export function FriendRow({ name, subtitle, avatarUri, presence, actions }: FriendRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.person}>
        <View>
          <Avatar name={name} uri={avatarUri} size={40} />
          {presence ? (
            <View style={styles.dot}>
              <PresenceDot status={presence} />
            </View>
          ) : null}
        </View>
        <View style={styles.texts}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={`${action.label} ${name}`}
            onPress={action.onPress}
            style={({ pressed }) => [styles.action, action.danger && styles.danger, pressed && styles.pressed]}
          >
            <Text style={[styles.actionText, action.danger && styles.dangerText]}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: { position: 'absolute', right: -4, bottom: -4 },
  texts: { flex: 1 },
  name: { color: colors.textStrong, fontSize: fontSize.md, fontWeight: '600' },
  subtitle: { color: colors.textMuted, fontSize: fontSize.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { minHeight: MIN_TOUCH - 8, minWidth: 64, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.bgAccent, alignItems: 'center', justifyContent: 'center' },
  danger: { backgroundColor: 'rgba(218, 62, 68, 0.18)' },
  pressed: { opacity: 0.8 },
  actionText: { color: colors.textNormal, fontSize: fontSize.sm, fontWeight: '600' },
  dangerText: { color: colors.textDanger }
})
