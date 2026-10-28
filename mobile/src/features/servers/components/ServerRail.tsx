import { Ionicons } from '@expo/vector-icons'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { colors, MIN_TOUCH, radius, spacing } from '../../../shared/theme/tokens'
import { Avatar } from '../../../shared/ui/Avatar'
import type { Server } from '../api/servers'

interface ServerRailProps {
  servers: Server[]
  /** Servidor aberto; null = área de DMs. */
  selectedId: string | null
  onSelect: (serverId: string | null) => void
}

const SIZE = 48

/** Trilho da esquerda: ícone de DMs no topo e um botão por servidor. */
export function ServerRail({ servers, selectedId, onSelect }: ServerRailProps) {
  return (
    <ScrollView style={styles.rail} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mensagens diretas"
        accessibilityState={{ selected: selectedId === null }}
        onPress={() => onSelect(null)}
        style={[styles.item, styles.home, selectedId === null && styles.selected]}
      >
        <Ionicons name="chatbubble" size={24} color={colors.white} />
      </Pressable>
      <View style={styles.divider} />
      {servers.map((server) => (
        <Pressable
          key={server.id}
          accessibilityRole="button"
          accessibilityLabel={server.name}
          accessibilityState={{ selected: selectedId === server.id }}
          onPress={() => onSelect(server.id)}
          style={styles.item}
        >
          <Avatar name={server.name} uri={server.icon_url} size={SIZE} square />
        </Pressable>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  rail: { width: 72, backgroundColor: colors.bgTertiary, flexGrow: 0 },
  content: { alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm },
  item: { width: SIZE, height: SIZE, minHeight: MIN_TOUCH, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  home: { backgroundColor: colors.bgAccent },
  selected: { backgroundColor: colors.brand },
  divider: { width: 32, height: 2, borderRadius: 1, backgroundColor: colors.borderSubtle }
})
