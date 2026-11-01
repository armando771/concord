import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '../theme/tokens'

type Variant = 'primary' | 'secondary' | 'danger'

interface ButtonProps {
  title: string
  onPress: () => void
  variant?: Variant
  /** Enviando: o botão fica desativado e mostra o indicador. */
  loading?: boolean
  disabled?: boolean
}

const BACKGROUND: Record<Variant, string> = {
  primary: colors.brand,
  secondary: colors.bgAccent,
  danger: colors.redStrong
}

export function Button({ title, onPress, variant = 'primary', loading = false, disabled = false }: ButtonProps) {
  const inactive = disabled || loading
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: BACKGROUND[variant] },
        pressed && styles.pressed,
        inactive && styles.inactive
      ]}
    >
      {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.title}>{title}</Text>}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
  pressed: { opacity: 0.85 },
  inactive: { opacity: 0.5 }
})
