import { useEffect, useState } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { onRealtimeReconnect } from '../../../shared/api/realtime'
import { onWsEvent } from '../../../shared/api/ws'
import { colors, fontSize, spacing } from '../../../shared/theme/tokens'
import { Banner } from '../../../shared/ui/Banner'
import { Button } from '../../../shared/ui/Button'
import { useAuthStore } from '../../auth/store/authStore'
import { usePresenceStore } from '../../friends/store/presenceStore'
import { getOrCreateConversationWith, type ConversationPerson } from '../api/conversations'
import {
  conversationSubtitle,
  conversationTitle,
  filterConversations,
  friendsWithoutConversation,
  peerIds
} from '../lib/conversationList'
import { useConversationsStore } from '../store/conversationsStore'
import { ConversationRow } from './ConversationRow'
import { DmSearch } from './DmSearch'

export interface OpenConversationArgs {
  id: string
  title: string
  type: 'dm' | 'group'
}

interface DirectMessagesProps {
  onOpenConversation: (args: OpenConversationArgs) => void
  onOpenFriends: () => void
}

/** Painel de DMs: busca, conversas (1 a 1 e grupos) com presença e amigos sem conversa na busca. */
export function DirectMessages({ onOpenConversation, onOpenFriends }: DirectMessagesProps) {
  const myId = useAuthStore((s) => s.user?.id)
  const conversations = useConversationsStore((s) => s.conversations)
  const status = useConversationsStore((s) => s.status)
  const friends = useConversationsStore((s) => s.friends)
  const load = useConversationsStore((s) => s.load)
  const loadFriends = useConversationsStore((s) => s.loadFriends)
  const statuses = usePresenceStore((s) => s.statuses)
  const loadPresence = usePresenceStore((s) => s.load)
  const applyPresence = usePresenceStore((s) => s.apply)
  const [query, setQuery] = useState('')
  const [openFailed, setOpenFailed] = useState(false)

  useEffect(() => {
    void load()
    return onRealtimeReconnect(() => void load())
  }, [load])

  const peers = peerIds(conversations).join(',')
  useEffect(() => {
    if (peers) void loadPresence(peers.split(','))
  }, [peers, loadPresence])

  useEffect(
    () =>
      onWsEvent((event) => {
        const payload = event.payload as { user_id?: string; status?: unknown; online?: unknown } | null
        if (event.type === 'presence:update' && payload) applyPresence(payload)
      }),
    [applyPresence]
  )

  useEffect(() => {
    if (query.trim()) void loadFriends()
  }, [query, loadFriends])

  const visible = filterConversations(conversations, query, myId)
  const offered = friendsWithoutConversation(friends, conversations, query)

  async function openFriend(friend: ConversationPerson): Promise<void> {
    setOpenFailed(false)
    try {
      const { id } = await getOrCreateConversationWith(friend.id)
      onOpenConversation({ id, title: friend.display_name, type: 'dm' })
    } catch {
      setOpenFailed(true)
    }
  }

  if (status === 'error' && conversations.length === 0) {
    return (
      <View style={styles.centered}>
        <Banner message="Não foi possível carregar as conversas." />
        <Button title="Tentar de novo" onPress={() => void load()} variant="secondary" />
      </View>
    )
  }

  const empty = status === 'ready' && conversations.length === 0 && !query.trim()
  const nothingFound = !!query.trim() && visible.length === 0 && offered.length === 0

  return (
    <FlatList
      style={styles.list}
      data={visible}
      keyExtractor={(c) => c.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View>
          <DmSearch value={query} onChangeText={setQuery} />
          <ConversationRow title="Amigos" icon="people" onPress={onOpenFriends} />
          <Text style={styles.section}>Mensagens diretas</Text>
          {empty ? <Text style={styles.note}>Você ainda não tem conversas.</Text> : null}
          {nothingFound ? <Text style={styles.note}>Nada encontrado.</Text> : null}
        </View>
      }
      renderItem={({ item }) => {
        const title = conversationTitle(item, myId)
        return (
          <ConversationRow
            title={title}
            subtitle={conversationSubtitle(item)}
            avatarUri={item.type === 'group' ? item.icon_url : item.other_user?.avatar_url}
            presence={item.type === 'dm' && item.other_user ? (statuses[item.other_user.id] ?? 'offline') : 'none'}
            unread={item.unread_count}
            onPress={() => onOpenConversation({ id: item.id, title, type: item.type })}
          />
        )
      }}
      ListFooterComponent={
        offered.length > 0 || openFailed ? (
          <View>
            {offered.length > 0 ? <Text style={styles.section}>Amigos</Text> : null}
            {offered.map((friend) => (
              <ConversationRow
                key={friend.id}
                title={friend.display_name}
                avatarUri={friend.avatar_url}
                onPress={() => void openFriend(friend)}
              />
            ))}
            {openFailed ? <Banner message="Não foi possível abrir a conversa." /> : null}
          </View>
        ) : undefined
      }
    />
  )
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bgPrimary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.bgPrimary },
  section: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  note: { color: colors.textMuted, fontSize: fontSize.sm, padding: spacing.md }
})
