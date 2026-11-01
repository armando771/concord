import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '../../../shared/theme/tokens'
import { IconButton } from '../../../shared/ui/IconButton'
import { useVoiceControlsStore } from '../../voice/store/voiceControlsStore'
import { phaseLabel } from '../lib/callLayout'
import { isInCall, useCallSessionStore } from '../store/callSessionStore'

interface CallBarProps {
  onOpen: () => void
  onLeave: () => void
}

/** Barra fixa acima do painel do usuário enquanto há chamada: toque abre a tela cheia; mudo e sair ficam à mão. */
export function CallBar({ onOpen, onLeave }: CallBarProps) {
  const inCall = useCallSessionStore((s) => isInCall(s))
  const name = useCallSessionStore((s) => s.name)
  const phase = useCallSessionStore((s) => s.phase)
  const muted = useVoiceControlsStore((s) => s.muted)
  const toggleMute = useVoiceControlsStore((s) => s.toggleMute)
  if (!inCall) return null

  const status = phaseLabel(phase) || 'Em chamada'
  return (
    <View style={styles.bar}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Abrir chamada em ${name}`} onPress={onOpen} style={styles.info}>
        <Ionicons name="volume-high" size={20} color={colors.textPositive} />
        <View style={styles.texts}>
          <Text style={styles.status} numberOfLines={1}>
            {status}
          </Text>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
        </View>
      </Pressable>
      <IconButton icon={muted ? 'mic-off' : 'mic'} label={muted ? 'Ativar microfone' : 'Silenciar microfone'} onPress={() => void toggleMute()} danger={muted} />
      <IconButton icon="call" label="Sair da chamada" onPress={onLeave} danger />
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginHorizontal: spacing.sm, paddingLeft: spacing.sm, backgroundColor: colors.bgSurface, borderRadius: radius.lg },
  info: { flex: 1, minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  texts: { flex: 1 },
  status: { color: colors.textPositive, fontSize: fontSize.xs, fontWeight: '700' },
  name: { color: colors.textStrong, fontSize: fontSize.sm }
})
