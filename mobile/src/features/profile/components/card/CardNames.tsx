import { StyleSheet, Text, View } from 'react-native'
import { fontSize, spacing } from '../../../../shared/theme/tokens'
import { nameColorOf } from '../../lib/cardName'
import type { CardLook } from '../../lib/cardLook'
import type { NameStyle } from '../../lib/nameStyle'

interface CardNamesProps {
  displayName: string
  username: string
  nameStyle?: Partial<NameStyle> | null
  pronouns?: string
  statusText?: string
  look: CardLook
}

/** Nome (na cor do estilo escolhido), @usuário, pronomes e status. Parte vazia não aparece. */
export function CardNames({ displayName, username, nameStyle, pronouns, statusText, look }: CardNamesProps) {
  const pronounsText = pronouns?.trim()
  const status = statusText?.trim()
  return (
    <View style={styles.names}>
      <Text numberOfLines={2} style={[styles.name, { color: nameColorOf(nameStyle, look.textColor) }]}>
        {displayName}
      </Text>
      <Text numberOfLines={1} style={[styles.small, { color: look.mutedColor }]}>
        @{username}
      </Text>
      {pronounsText ? (
        <Text testID="card-pronouns" numberOfLines={1} style={[styles.small, { color: look.mutedColor }]}>
          {pronounsText}
        </Text>
      ) : null}
      {status ? (
        <Text testID="card-status" style={[styles.status, { color: look.textColor }]}>
          {status}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  names: { gap: spacing.xs },
  name: { fontSize: fontSize.xl, fontWeight: '700' },
  small: { fontSize: fontSize.sm },
  status: { fontSize: fontSize.md, marginTop: spacing.xs }
})
