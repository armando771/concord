import { StyleSheet, Text, View } from 'react-native'
import { colors, fontSize } from '../../../shared/theme/tokens'
import { badgeText, unreadLabel } from '../lib/unreadCounts'

interface UnreadBadgeProps {
  count: number
}

/** Selo vermelho com o número de mensagens não lidas (DMs); sem não lidas não aparece. */
export function UnreadBadge({ count }: UnreadBadgeProps) {
  if (count <= 0) return null
  return (
    <View accessible accessibilityLabel={unreadLabel(count)} style={styles.badge}>
      <Text style={styles.text}>{badgeText(count)}</Text>
    </View>
  )
}

/** Ponto branco de "tem não lida" (servidor e canal: o backend não guarda a contagem). */
export function UnreadDot() {
  return <View accessible accessibilityLabel="Mensagens não lidas" style={styles.dot} />
}

const styles = StyleSheet.create({
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bgPrimary },
  text: { color: colors.white, fontSize: fontSize.xs - 1, fontWeight: '800' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textStrong }
})
