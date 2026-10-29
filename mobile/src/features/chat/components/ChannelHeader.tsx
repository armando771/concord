import { StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, spacing } from '../../../shared/theme/tokens'
import { IconButton } from '../../../shared/ui/IconButton'

interface ChannelHeaderProps {
  name: string
  onBack: () => void
}

/** Topo do chat: voltar para a lista e o nome do canal. */
export function ChannelHeader({ name, onBack }: ChannelHeaderProps) {
  return (
    <View style={styles.bar}>
      <IconButton icon="arrow-back" label="Voltar" onPress={onBack} />
      <Text style={styles.hash}>#</Text>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, backgroundColor: colors.bgPrimary, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  hash: { color: colors.interactiveNormal, fontSize: fontSize.lg },
  name: { flex: 1, color: colors.textStrong, fontSize: fontSize.lg, fontWeight: '700' }
})
