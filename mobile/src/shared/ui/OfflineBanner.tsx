import { StyleSheet, Text, View } from 'react-native'
import { useNetworkStore } from '../store/networkStore'
import { colors, fontSize, spacing } from '../theme/tokens'

/** Faixa no topo quando o sistema está sem rede. */
export function OfflineBanner() {
  const online = useNetworkStore((s) => s.online)
  if (online) return null
  return (
    <View accessibilityRole="alert" style={styles.banner}>
      <Text style={styles.text}>Sem conexão</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.yellow, paddingVertical: spacing.xs, alignItems: 'center' },
  text: { color: colors.bgApp, fontSize: fontSize.sm, fontWeight: '700' }
})
