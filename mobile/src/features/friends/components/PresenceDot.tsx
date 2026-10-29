import { StyleSheet, View } from 'react-native'
import { colors } from '../../../shared/theme/tokens'
import { STATUS_COLOR, STATUS_LABEL, type PresenceStatus } from '../lib/presenceStatus'

interface PresenceDotProps {
  /** Sem status conhecido, vale offline. */
  status: PresenceStatus | undefined
  /** Cor do recorte ao redor da bolinha: a do fundo onde ela está (padrão: o fundo do app). */
  cutout?: string
}

/** Bolinha de presença no canto do avatar, com o recorte na cor do fundo (como no Discord). */
export function PresenceDot({ status = 'offline', cutout = colors.bgPrimary }: PresenceDotProps) {
  return (
    <View
      accessible
      accessibilityLabel={STATUS_LABEL[status]}
      style={[styles.dot, { backgroundColor: STATUS_COLOR[status], borderColor: cutout }]}
    />
  )
}

const styles = StyleSheet.create({
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: colors.bgPrimary }
})
