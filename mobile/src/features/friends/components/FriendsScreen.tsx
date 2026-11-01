import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '../../../shared/theme/tokens'
import { Banner } from '../../../shared/ui/Banner'
import { Button } from '../../../shared/ui/Button'
import { IconButton } from '../../../shared/ui/IconButton'
import { getOrCreateConversationWith } from '../../chat/api/conversations'
import type { OpenConversationArgs } from '../../chat/components/DirectMessages'
import type { Friend } from '../api/friends'
import { useFriendsLive } from '../hooks/useFriendsLive'
import { onlineFriends, sortByName, splitPending } from '../lib/friendLists'
import { useFriendsStore } from '../store/friendsStore'
import { usePresenceStore } from '../store/presenceStore'
import { AddFriend } from './AddFriend'
import { FriendRow, type RowAction } from './FriendRow'
import { FriendsTabs, type FriendsTab } from './FriendsTabs'

interface FriendsScreenProps {
  onBack: () => void
  onOpenConversation: (args: OpenConversationArgs) => void
  /** Tocar numa pessoa abre o perfil dela. */
  onOpenProfile?: (userId: string) => void
}

type Confirm = { kind: 'remove' | 'block'; person: Friend }

const EMPTY: Record<Exclude<FriendsTab, 'add'>, string> = {
  online: 'Nenhum amigo online agora.',
  all: 'Você ainda não tem amigos.',
  pending: 'Nenhum pedido pendente.',
  blocked: 'Ninguém bloqueado.'
}

/** Tela de Amigos: Online, Todos, Pendentes, Bloqueados e Adicionar, com as ações de cada lista. */
export function FriendsScreen({ onBack, onOpenConversation, onOpenProfile }: FriendsScreenProps) {
  useFriendsLive()
  const { top } = useSafeAreaInsets()
  const friends = useFriendsStore((s) => s.friends)
  const pending = useFriendsStore((s) => s.pending)
  const blocked = useFriendsStore((s) => s.blocked)
  const status = useFriendsStore((s) => s.status)
  const statuses = usePresenceStore((s) => s.statuses)
  const [tab, setTab] = useState<FriendsTab>('online')
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const friendIds = friends.map((f) => f.id).join(',')
  useEffect(() => {
    if (friendIds) void usePresenceStore.getState().load(friendIds.split(','))
  }, [friendIds])

  /** Roda uma ação do store e mostra o aviso se falhar (a lista continua como estava). */
  async function run(action: Promise<'ok' | 'error'>): Promise<void> {
    setNotice((await action) === 'error' ? 'Não foi possível concluir a ação.' : null)
  }

  async function message(friend: Friend): Promise<void> {
    try {
      const { id } = await getOrCreateConversationWith(friend.id)
      setNotice(null)
      onOpenConversation({ id, title: friend.display_name, type: 'dm' })
    } catch {
      setNotice('Não foi possível abrir a conversa.')
    }
  }

  const store = useFriendsStore.getState
  const open = (id: string) => (onOpenProfile ? () => onOpenProfile(id) : undefined)
  const friendActions = (f: Friend): RowAction[] => [
    { label: 'Mensagem', onPress: () => void message(f) },
    { label: 'Remover amigo', danger: true, onPress: () => setConfirm({ kind: 'remove', person: f }) },
    { label: 'Bloquear', danger: true, onPress: () => setConfirm({ kind: 'block', person: f }) }
  ]

  function confirmed(): void {
    if (!confirm) return
    const { kind, person } = confirm
    setConfirm(null)
    void run(kind === 'remove' ? store().remove(person.username) : store().block(person.id))
  }

  const renderFriends = (list: Friend[]) =>
    list.map((f) => (
      <FriendRow key={f.id} onPress={open(f.id)} name={f.display_name} avatarUri={f.avatar_url} presence={statuses[f.id] ?? 'offline'} actions={friendActions(f)} />
    ))

  function body() {
    if (tab === 'add') return <AddFriend />
    const rows = rowsFor(tab)
    // Falha em qualquer lista: aviso com tentar de novo; sem linhas, ele substitui o "vazio" (não é que não haja ninguém).
    const failure =
      status === 'error' ? (
        <View style={styles.centered}>
          <Banner message="Não foi possível carregar os amigos." />
          <Button title="Tentar de novo" onPress={() => void store().load()} variant="secondary" />
        </View>
      ) : null
    if (rows.length > 0) return [failure, ...rows]
    return failure ?? <Text style={styles.empty}>{EMPTY[tab]}</Text>
  }

  function rowsFor(current: Exclude<FriendsTab, 'add'>) {
    if (current === 'online') return renderFriends(onlineFriends(friends, statuses))
    if (current === 'all') return renderFriends(sortByName(friends))
    if (current === 'blocked') {
      return sortByName(blocked).map((p) => (
        <FriendRow key={p.id} onPress={open(p.id)} name={p.display_name} avatarUri={p.avatar_url} actions={[{ label: 'Desbloquear', onPress: () => void run(store().unblock(p.id)) }]} />
      ))
    }
    const { incoming, outgoing } = splitPending(pending)
    return [
      ...incoming.map((p) => (
        <FriendRow
          key={p.user_id}
          name={p.display_name}
          avatarUri={p.avatar_url}
          onPress={open(p.user_id)}
          subtitle="Pedido recebido"
          actions={[
            { label: 'Aceitar', onPress: () => void run(store().accept(p.username)) },
            { label: 'Recusar', danger: true, onPress: () => void run(store().decline(p.username)) }
          ]}
        />
      )),
      ...outgoing.map((p) => (
        <FriendRow
          key={p.user_id}
          name={p.display_name}
          avatarUri={p.avatar_url}
          onPress={open(p.user_id)}
          subtitle="Pedido enviado"
          actions={[{ label: 'Cancelar pedido', danger: true, onPress: () => void run(store().cancel(p.username)) }]}
        />
      ))
    ]
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={top}>
      <View style={styles.header}>
        <IconButton icon="arrow-back" label="Voltar" onPress={onBack} />
        <Text style={styles.title}>Amigos</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Adicionar amigo"
          accessibilityState={{ selected: tab === 'add' }}
          onPress={() => setTab('add')}
          style={[styles.addButton, tab === 'add' && styles.addButtonOn]}
        >
          <Text style={styles.addText}>Adicionar amigo</Text>
        </Pressable>
      </View>
      <FriendsTabs selected={tab} onSelect={setTab} />
      {notice ? <Banner message={notice} /> : null}
      {confirm ? (
        <View style={styles.confirm}>
          <Text style={styles.confirmText}>
            {confirm.kind === 'remove' ? `Remover ${confirm.person.display_name} dos amigos?` : `Bloquear ${confirm.person.display_name}?`}
          </Text>
          <View style={styles.confirmButtons}>
            <Button title="Confirmar" variant="danger" onPress={confirmed} />
            <Button title="Cancelar" variant="secondary" onPress={() => setConfirm(null)} />
          </View>
        </View>
      ) : null}
      <ScrollView keyboardShouldPersistTaps="handled">{body()}</ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  title: { flex: 1, color: colors.textStrong, fontSize: fontSize.lg, fontWeight: '700' },
  addButton: { minHeight: MIN_TOUCH - 8, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.greenStrong, justifyContent: 'center' },
  addButtonOn: { backgroundColor: colors.green },
  addText: { color: colors.white, fontSize: fontSize.sm, fontWeight: '700' },
  centered: { alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  empty: { color: colors.textMuted, fontSize: fontSize.md, textAlign: 'center', padding: spacing.xl },
  confirm: { margin: spacing.sm, padding: spacing.md, gap: spacing.md, borderRadius: 8, backgroundColor: colors.bgSurface },
  confirmText: { color: colors.textStrong, fontSize: fontSize.md, fontWeight: '600' },
  confirmButtons: { gap: spacing.sm }
})
