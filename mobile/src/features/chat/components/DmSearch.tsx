import { StyleSheet, TextInput } from 'react-native'
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '../../../shared/theme/tokens'

interface DmSearchProps {
  value: string
  onChangeText: (text: string) => void
}

const LABEL = 'Encontre ou comece uma conversa'

/** Campo de busca do topo do painel de DMs. */
export function DmSearch({ value, onChangeText }: DmSearchProps) {
  return (
    <TextInput
      accessibilityLabel={LABEL}
      placeholder={LABEL}
      placeholderTextColor={colors.textFaint}
      value={value}
      onChangeText={onChangeText}
      autoCapitalize="none"
      autoCorrect={false}
      style={styles.input}
    />
  )
}

const styles = StyleSheet.create({
  input: { minHeight: MIN_TOUCH, margin: spacing.sm, borderRadius: radius.md, backgroundColor: colors.bgInput, color: colors.textNormal, fontSize: fontSize.sm, paddingHorizontal: spacing.md }
})
