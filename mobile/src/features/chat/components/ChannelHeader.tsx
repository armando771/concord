import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, MIN_TOUCH, spacing } from '../../../shared/theme/tokens'
import { IconButton } from '../../../shared/ui/IconButton'

interface ChannelHeaderProps {
  name: string
  /** "#" no canal (padrão), "@" na DM 1 a 1, vazio no grupo. */
  prefix?: string
  onBack: () => void
  /** Na DM 1 a 1, tocar no nome abre o perfil da pessoa. Sem ele, o nome é só texto. */
  onPressName?: () => void
}

/** Topo do chat: voltar para a lista e o nome do canal. */
export function ChannelHeader({ name, prefix = '#', onBack, onPressName }: ChannelHeaderProps) {
  const title = (
    <Text style={styles.name} numberOfLines={1}>
      {name}
    </Text>
  )
  return (
    <View style={styles.bar}>
      <IconButton icon="arrow-back" label="Voltar" onPress={onBack} />
      {prefix ? <Text style={styles.hash}>{prefix}</Text> : null}
      <View style={styles.nameBox}>
        {onPressName ? (
          <Pressable accessibilityRole="button" accessibilityLabel={name} onPress={onPressName} style={styles.nameButton}>
            {title}
          </Pressable>
        ) : (
          title
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, backgroundColor: colors.bgPrimary, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  hash: { color: colors.interactiveNormal, fontSize: fontSize.lg },
  nameBox: { flex: 1 },
  nameButton: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  name: { color: colors.textStrong, fontSize: fontSize.lg, fontWeight: '700' }
})
