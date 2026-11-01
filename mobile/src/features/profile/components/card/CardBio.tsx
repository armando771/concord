import { StyleSheet, Text } from 'react-native'
import { colors, fontSize } from '../../../../shared/theme/tokens'
import type { CardLook } from '../../lib/cardLook'
import { splitLinks } from '../../lib/profileLinks'

interface CardBioProps {
  text: string
  look: CardLook
  onOpen: (url: string) => void
}

/** "Sobre mim": o texto com os links http(s) tocáveis. */
export function CardBio({ text, look, onOpen }: CardBioProps) {
  return (
    <Text style={[styles.text, { color: look.textColor }]}>
      {splitLinks(text).map((part, index) =>
        part.url ? (
          <Text key={index} accessibilityRole="link" style={styles.link} onPress={() => onOpen(part.url as string)}>
            {part.text}
          </Text>
        ) : (
          part.text
        )
      )}
    </Text>
  )
}

const styles = StyleSheet.create({
  text: { fontSize: fontSize.md },
  link: { color: colors.textLink, textDecorationLine: 'underline' }
})
