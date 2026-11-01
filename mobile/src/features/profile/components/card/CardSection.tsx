import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { fontSize, spacing } from '../../../../shared/theme/tokens'
import type { CardLook } from '../../lib/cardLook'

interface CardSectionProps {
  title: string
  look: CardLook
  children: ReactNode
}

/** Bloco do cartão com título em caixa alta ("Sobre mim", "Links"). */
export function CardSection({ title, look, children }: CardSectionProps) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.title, { color: look.mutedColor }]}>
        {title}
      </Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs },
  title: { fontSize: fontSize.xs, fontWeight: '700', textTransform: 'uppercase' }
})
