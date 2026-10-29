import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, fontSize, spacing } from '../../../shared/theme/tokens'
import { IconButton } from '../../../shared/ui/IconButton'
import { useAuthStore } from '../../auth/store/authStore'
import { VoiceControls } from '../../voice/components/VoiceControls'
import { gridColumns, phaseLabel } from '../lib/callLayout'
import { NO_VOICE, type CallUser } from '../lib/callTypes'
import { useCallSessionStore } from '../store/callSessionStore'
import { useParticipantsStore, voiceOf } from '../store/participantsStore'
import { useSpeakingStore } from '../store/speakingStore'
import { CallNotice } from './CallNotice'
import { ParticipantTile } from './ParticipantTile'

interface CallScreenProps {
  onBack: () => void
  onLeave: () => void
  onOpenSettings?: () => void
}

/** Tela cheia da chamada: quem está nela (grade que se adapta à largura), quem fala e os controles. */
export function CallScreen({ onBack, onLeave, onOpenSettings }: CallScreenProps) {
  const { width } = useWindowDimensions()
  const name = useCallSessionStore((s) => s.name)
  const phase = useCallSessionStore((s) => s.phase)
  const others = useParticipantsStore((s) => s.people)
  const voice = useParticipantsStore((s) => s.voice)
  const speaking = useSpeakingStore((s) => s.speaking)
  const me = useAuthStore((s) => s.user)

  const people: CallUser[] = me ? [{ id: me.id, username: me.username, display_name: me.display_name, avatar_url: me.avatar_url }, ...others] : others
  const columns = gridColumns(width, people.length)
  const status = phaseLabel(phase)

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <IconButton icon="chevron-down" label="Minimizar chamada" onPress={onBack} />
        <View style={styles.titles}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {status ? <Text style={styles.status}>{status}</Text> : null}
        </View>
      </View>
      <CallNotice onOpenSettings={onOpenSettings} />
      <FlatList
        key={columns}
        data={people}
        numColumns={columns}
        keyExtractor={(p) => p.id}
        columnWrapperStyle={columns > 1 ? styles.row : undefined}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <ParticipantTile user={item} speaking={speaking.includes(item.id)} voice={item.id === me?.id ? NO_VOICE : voiceOf(voice, item.id)} />
        )}
      />
      <View style={styles.controls}>
        <VoiceControls />
        <IconButton icon="call" label="Sair da chamada" onPress={onLeave} danger />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm },
  titles: { flex: 1 },
  name: { color: colors.textStrong, fontSize: fontSize.lg, fontWeight: '700' },
  status: { color: colors.textMuted, fontSize: fontSize.sm },
  grid: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  row: { gap: spacing.md },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.md }
})
