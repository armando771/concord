import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '../../../shared/theme/tokens'

export type FriendsTab = 'online' | 'all' | 'pending' | 'blocked' | 'add'

const TABS: { id: FriendsTab; label: string }[] = [
  { id: 'online', label: 'Online' },
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Pendentes' },
  { id: 'blocked', label: 'Bloqueados' },
  { id: 'add', label: 'Adicionar amigo' }
]

interface FriendsTabsProps {
  selected: FriendsTab
  onSelect: (tab: FriendsTab) => void
}

/** Abas da tela de Amigos (rolam na horizontal em telas estreitas). */
export function FriendsTabs({ selected, onSelect }: FriendsTabsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={styles.scroll}>
      {TABS.map((tab) => (
        <Pressable
          key={tab.id}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: selected === tab.id }}
          onPress={() => onSelect(tab.id)}
          style={[styles.tab, selected === tab.id && styles.selected, tab.id === 'add' && styles.add]}
        >
          <Text style={[styles.text, selected === tab.id && styles.selectedText]}>{tab.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  tabs: { gap: spacing.sm, padding: spacing.sm },
  tab: { minHeight: MIN_TOUCH - 4, paddingHorizontal: spacing.md, borderRadius: radius.md, justifyContent: 'center' },
  selected: { backgroundColor: colors.bgAccent },
  add: { backgroundColor: colors.greenStrong },
  text: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
  selectedText: { color: colors.textStrong }
})
