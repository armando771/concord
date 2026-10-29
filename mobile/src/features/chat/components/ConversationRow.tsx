import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '../../../shared/theme/tokens'
import { Avatar } from '../../../shared/ui/Avatar'
import { PresenceDot } from '../../friends/components/PresenceDot'
import type { PresenceStatus } from '../../friends/lib/presenceStatus'
import { UnreadBadge } from './UnreadBadge'

interface ConversationRowProps {
  title: string
  subtitle?: string | null
  avatarUri?: string | null
  /** Só nas DMs 1 a 1; o grupo não mostra bolinha. */
  presence?: PresenceStatus | 'none'
  /** Mensagens não lidas (selo vermelho à direita). */
  unread?: number
  /** Atalho (ex.: "Amigos"): mostra este ícone no lugar do avatar com a inicial. */
  icon?: keyof typeof Ionicons.glyphMap
  onPress: () => void
}

export function ConversationRow({ title, subtitle, avatarUri, presence = 'none', unread = 0, icon, onPress }: ConversationRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View>
        {icon ? (
          <View style={styles.iconCircle}>
            <Ionicons name={icon} size={22} color={colors.white} />
          </View>
        ) : (
          <Avatar name={title} uri={avatarUri} size={40} />
        )}
        {presence !== 'none' ? (
          <View style={styles.dot}>
            <PresenceDot status={presence} />
          </View>
        ) : null}
      </View>
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <UnreadBadge count={unread} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md },
  pressed: { backgroundColor: colors.bgAccent },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgAccent, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', right: -4, bottom: -4 },
  texts: { flex: 1, minHeight: MIN_TOUCH - 8, justifyContent: 'center' },
  title: { color: colors.textStrong, fontSize: fontSize.md, fontWeight: '600' },
  subtitle: { color: colors.textMuted, fontSize: fontSize.xs }
})
