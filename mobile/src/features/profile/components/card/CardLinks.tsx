import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, MIN_TOUCH, spacing } from '../../../../shared/theme/tokens'
import type { CardLook } from '../../lib/cardLook'
import { linkError, linkLabel } from '../../lib/profileLinks'

/** Abre o endereço no navegador; falhar em abrir não pode derrubar a tela. */
export const openExternal = (url: string): void => {
  void Linking.openURL(url).catch(() => {})
}

interface CardLinksProps {
  links: { url: string }[]
  look: CardLook
  onOpen?: (url: string) => void
}

/** Lista de links do perfil. Só http(s) é tocável; qualquer outra coisa aparece como texto. */
export function CardLinks({ links, look, onOpen = openExternal }: CardLinksProps) {
  return (
    <View style={styles.list}>
      {links.map(({ url }) =>
        linkError(url) ? (
          <Text key={url} style={[styles.text, { color: look.mutedColor }]}>
            {url}
          </Text>
        ) : (
          <Pressable key={url} accessibilityRole="link" accessibilityLabel={linkLabel(url)} onPress={() => onOpen(url)} style={styles.row}>
            <Text numberOfLines={1} style={[styles.text, styles.link]}>
              {linkLabel(url)}
            </Text>
          </Pressable>
        )
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
  row: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  text: { fontSize: fontSize.md },
  link: { color: colors.textLink }
})
