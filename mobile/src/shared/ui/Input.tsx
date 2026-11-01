import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native'
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '../theme/tokens'

interface InputProps extends TextInputProps {
  label: string
  /** Mensagem de erro do campo, mostrada embaixo. */
  error?: string | null
}

export function Input({ label, error, style, ...rest }: InputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textFaint}
        {...rest}
        style={[styles.input, error ? styles.inputError : null, style]}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: '700', textTransform: 'uppercase' },
  input: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderNormal,
    backgroundColor: colors.bgInput,
    color: colors.textNormal,
    fontSize: fontSize.md,
    paddingHorizontal: spacing.md
  },
  inputError: { borderColor: colors.red },
  error: { color: colors.textDanger, fontSize: fontSize.sm }
})
