import { StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, radius, spacing } from '../theme/tokens'

interface BannerProps {
  message: string
  tone?: 'error' | 'info'
}

/** Aviso em bloco (erro de envio, "sessão expirou"). */
export function Banner({ message, tone = 'error' }: BannerProps) {
  return (
    <View accessibilityRole="alert" style={[styles.box, tone === 'error' ? styles.error : styles.info]}>
      <Text style={[styles.text, tone === 'error' ? styles.errorText : styles.infoText]}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  error: { borderColor: 'rgba(218, 62, 68, 0.3)', backgroundColor: 'rgba(218, 62, 68, 0.15)' },
  info: { borderColor: colors.borderNormal, backgroundColor: colors.bgSurface },
  text: { fontSize: fontSize.sm },
  errorText: { color: colors.textDanger },
  infoText: { color: colors.textNormal }
})
