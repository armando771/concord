import { Pressable, StyleSheet, Text } from 'react-native'
import { colors, fontSize, MIN_TOUCH } from '../theme/tokens'

interface TextLinkProps {
  title: string
  onPress: () => void
}

/** Link de texto (alvo de toque de 44 dp, anunciado como link). */
export function TextLink({ title, onPress }: TextLinkProps) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={title} onPress={onPress} style={styles.link}>
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  link: { minHeight: MIN_TOUCH, justifyContent: 'center', alignSelf: 'flex-start' },
  text: { color: colors.textLink, fontSize: fontSize.sm, fontWeight: '600' }
})
