import { StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, spacing } from '../theme/tokens'

interface ComingSoonProps {
  title: string
}

/** Espaço reservado das abas que chegam nas próximas fatias. */
export function ComingSoon({ title }: ComingSoonProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>Em breve</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.bgPrimary },
  title: { color: colors.textStrong, fontSize: fontSize.lg, fontWeight: '700' },
  text: { color: colors.textMuted, fontSize: fontSize.md }
})
