import { StyleSheet, View } from 'react-native'
import { colors } from '../../../shared/theme/tokens'
import { STATUS_COLOR, STATUS_LABEL, type PresenceStatus } from '../lib/presenceStatus'

interface PresenceDotProps {
  /** Sem status conhecido, vale offline. */
  status: PresenceStatus | undefined
}

/** Bolinha de presença no canto do avatar, com o recorte na cor do fundo (como no Discord). */
export function PresenceDot({ status = 'offline' }: PresenceDotProps) {
  return (
    <View
      accessible
      accessibilityLabel={STATUS_LABEL[status]}
      style={[styles.dot, { backgroundColor: STATUS_COLOR[status] }]}
    />
  )
}

const styles = StyleSheet.create({
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: colors.bgPrimary }
})
