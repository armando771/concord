import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '../../../shared/theme/tokens'
import { Banner } from '../../../shared/ui/Banner'
import { Button } from '../../../shared/ui/Button'
import type { Channel } from '../api/channels'
import { channelSections } from '../lib/channelSections'

interface ChannelListProps {
  serverName: string
  channels: Channel[]
  /** A lista de canais deste servidor falhou ao carregar. */
  error: boolean
  onOpenChannel: (channel: Channel) => void
  onRetry: () => void
}

/** Coluna do meio: nome do servidor e os canais de texto e de voz. */
export function ChannelList({ serverName, channels, error, onOpenChannel, onRetry }: ChannelListProps) {
  const [voiceNotice, setVoiceNotice] = useState(false)

  const open = (channel: Channel): void => {
    if (channel.type === 'voice') return setVoiceNotice(true)
    setVoiceNotice(false)
    onOpenChannel(channel)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.server} numberOfLines={1}>
        {serverName}
      </Text>
      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <View style={styles.error}>
            <Banner message="Não foi possível carregar os canais." />
            <Button title="Tentar de novo" onPress={onRetry} variant="secondary" />
          </View>
        ) : null}
        {channelSections(channels).map((section) => (
          <View key={section.kind}>
            <Text style={styles.section}>{section.title}</Text>
            {section.channels.map((channel) => (
              <Pressable
                key={channel.id}
                accessibilityRole="button"
                accessibilityLabel={channel.name}
                onPress={() => open(channel)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                {channel.type === 'voice' ? (
                  <Ionicons name="volume-high" size={20} color={colors.interactiveNormal} />
                ) : (
                  <Text style={styles.hash}>#</Text>
                )}
                <Text style={styles.name} numberOfLines={1}>
                  {channel.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
        {voiceNotice ? <Banner tone="info" message="Canais de voz chegam em breve" /> : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary, borderTopLeftRadius: radius.lg },
  server: { color: colors.textStrong, fontSize: fontSize.lg, fontWeight: '700', padding: spacing.lg },
  content: { paddingHorizontal: spacing.sm, paddingBottom: spacing.xl, gap: spacing.sm },
  section: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700', padding: spacing.sm },
  row: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  pressed: { backgroundColor: colors.bgAccent },
  hash: { color: colors.interactiveNormal, fontSize: fontSize.lg, width: 20, textAlign: 'center' },
  name: { color: colors.textSecondary, fontSize: fontSize.md, flexShrink: 1 },
  error: { gap: spacing.sm, padding: spacing.sm }
})
