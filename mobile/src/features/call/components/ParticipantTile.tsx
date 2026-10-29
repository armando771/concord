import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, radius, spacing } from '../../../shared/theme/tokens'
import { Avatar } from '../../../shared/ui/Avatar'
import type { CallUser, VoiceState } from '../lib/callTypes'

interface ParticipantTileProps {
  user: CallUser
  speaking: boolean
  voice: VoiceState
}

function stateOf(speaking: boolean, voice: VoiceState): string {
  if (voice.deafened || voice.serverDeafened) return 'ensurdecido'
  if (voice.muted || voice.serverMuted) return 'mudo'
  return speaking ? 'falando' : ''
}

/** Uma pessoa na grade da chamada: foto, nome, anel verde quando fala e ícone de mudo ou fone. */
export function ParticipantTile({ user, speaking, voice }: ParticipantTileProps) {
  const state = stateOf(speaking, voice)
  const off = state === 'mudo' || state === 'ensurdecido'
  return (
    <View accessible accessibilityLabel={state ? `${user.display_name}, ${state}` : user.display_name} style={[styles.tile, speaking && !off && styles.speaking]}>
      <Avatar name={user.display_name} uri={user.avatar_url} size={64} />
      <View style={styles.row}>
        {off ? <Ionicons name={state === 'mudo' ? 'mic-off' : 'volume-mute'} size={14} color={colors.textDanger} /> : null}
        <Text style={styles.name} numberOfLines={1}>
          {user.display_name}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  tile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md, minHeight: 120, backgroundColor: colors.bgSurface, borderRadius: radius.lg, borderWidth: 2, borderColor: 'transparent' },
  speaking: { borderColor: colors.green },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: '100%' },
  name: { color: colors.textStrong, fontSize: fontSize.sm, fontWeight: '600', flexShrink: 1 }
})
