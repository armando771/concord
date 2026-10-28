import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet } from 'react-native'
import { colors, MIN_TOUCH, radius } from '../theme/tokens'

interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap
  /** Texto lido pelo leitor de tela (e usado nos testes). */
  label: string
  onPress: () => void
  /** Destaca o botão (ex.: microfone silenciado fica vermelho). */
  danger?: boolean
}

/** Botão só de ícone com alvo de toque de 44 dp. */
export function IconButton({ icon, label, onPress, danger = false }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={22} color={danger ? colors.textDanger : colors.interactiveNormal} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.bgAccent }
})
