import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, fontSize, spacing } from '../../../shared/theme/tokens'
import { Avatar } from '../../../shared/ui/Avatar'
import { Button } from '../../../shared/ui/Button'
import { useIncomingCallStore } from '../store/incomingCallStore'

interface IncomingCallScreenProps {
  onAccept: () => void
  onDecline: () => void
}

/** Chamada de DM tocando: quem está ligando e os botões de atender e recusar. */
export function IncomingCallScreen({ onAccept, onDecline }: IncomingCallScreenProps) {
  const call = useIncomingCallStore((s) => s.call)
  if (!call) return null
  const { initiator } = call
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.who}>
        <Avatar name={initiator.display_name} uri={initiator.avatar_url} size={112} />
        <Text style={styles.name} numberOfLines={2}>
          {initiator.display_name}
        </Text>
        <Text style={styles.hint}>Está te ligando</Text>
      </View>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button title="Recusar" variant="danger" onPress={onDecline} />
        </View>
        <View style={styles.action}>
          <Button title="Atender" onPress={onAccept} />
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp, justifyContent: 'space-between', padding: spacing.xl },
  who: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  name: { color: colors.textStrong, fontSize: fontSize.xl, fontWeight: '700', textAlign: 'center' },
  hint: { color: colors.textMuted, fontSize: fontSize.md },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 }
})
