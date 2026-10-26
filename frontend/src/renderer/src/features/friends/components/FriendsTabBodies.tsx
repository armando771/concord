import type { ComponentType } from 'react'
import { ClockIcon, FriendsIcon, OnlineIcon, UserPlusIcon, XIcon } from '../../../shared/ui/icons'
import { PersonListSkeleton } from '../../../shared/ui/skeleton/layouts'
import type { FriendsTab } from '../../../shared/store/uiStore'
import type { PendingRequest } from '../api/friends'
import type { PublicUser } from '../../auth/store/authStore'
import { useChatStore } from '../../chat/store/chatStore'
import { useFriendStore } from '../store/friendStore'
import { useFriendsFirstLoad } from '../hooks/useFriendsFirstLoad'
import { filterPeople } from '../lib/personFilter'
import { onlineFriends } from '../lib/onlineFriends'
import AddFriend from './AddFriend'
import EmptyState from './EmptyState'
import { BlockedRow, FriendRow, PendingRow } from './FriendRows'

export interface TabBodyProps {
  filterText: string
}

function SectionTitle({ label, count }: { label: string; count: number }): React.JSX.Element {
  return (
    <h3 className="mb-2 mt-4 text-ds-sm font-medium text-gray-400">
      {label} — {count}
    </h3>
  )
}

const LIST_COPY = {
  online: {
    Icon: OnlineIcon,
    title: 'Online',
    empty: 'Nenhum amigo online agora. Volte mais tarde!'
  },
  all: {
    Icon: FriendsIcon,
    title: 'Todos os amigos',
    empty: 'Você ainda não tem amigos. Mande um pedido em "Adicionar amigo".'
  }
} as const

function FriendsListTab({
  kind,
  filterText
}: TabBodyProps & { kind: keyof typeof LIST_COPY }): React.JSX.Element {
  const friends = useFriendStore((s) => s.friends)
  const presence = useChatStore((s) => s.presence)
  const statuses = useChatStore((s) => s.statuses)
  const firstLoad = useFriendsFirstLoad()
  const copy = LIST_COPY[kind]
  if (firstLoad) return <PersonListSkeleton actions={2} />

  const base: PublicUser[] = kind === 'online' ? onlineFriends(friends, presence, statuses) : friends
  if (base.length === 0) return <EmptyState icon={<copy.Icon className="h-10 w-10" />} text={copy.empty} />

  const list = filterPeople(base, filterText)
  return (
    <>
      <SectionTitle label={copy.title} count={list.length} />
      {list.map((f) => (
        <FriendRow key={f.id} friend={f} />
      ))}
    </>
  )
}

function PendingSection({ label, items }: { label: string; items: PendingRequest[] }): React.JSX.Element {
  return (
    <>
      {items.length > 0 && <SectionTitle label={label} count={items.length} />}
      {items.map((p) => (
        <PendingRow key={p.user_id} request={p} />
      ))}
    </>
  )
}

function PendingTab({ filterText }: TabBodyProps): React.JSX.Element {
  const pending = useFriendStore((s) => s.pending)
  const firstLoad = useFriendsFirstLoad()
  if (firstLoad) return <PersonListSkeleton actions={2} />
  if (pending.length === 0) {
    return (
      <EmptyState
        icon={<ClockIcon className="h-10 w-10" />}
        text="Não há pedidos de amizade pendentes. Que tal mandar um?"
      />
    )
  }
  const visible = filterPeople(pending, filterText)
  return (
    <>
      <PendingSection label="Recebidos" items={visible.filter((p) => p.direction === 'incoming')} />
      <PendingSection label="Enviados" items={visible.filter((p) => p.direction === 'outgoing')} />
    </>
  )
}

function BlockedTab({ filterText }: TabBodyProps): React.JSX.Element {
  const blocked = useFriendStore((s) => s.blocked)
  const firstLoad = useFriendsFirstLoad()
  if (firstLoad) return <PersonListSkeleton actions={1} />
  if (blocked.length === 0) {
    return (
      <EmptyState
        icon={<XIcon className="h-10 w-10" />}
        text="Você não bloqueou ninguém. Quem você bloquear aparece aqui."
      />
    )
  }
  const visible = filterPeople(blocked, filterText)
  return (
    <>
      <SectionTitle label="Bloqueados" count={visible.length} />
      {visible.map((u) => (
        <BlockedRow key={u.id} user={u} />
      ))}
    </>
  )
}

function AddTab(): React.JSX.Element {
  return (
    <>
      <AddFriend />
      <EmptyState
        icon={<UserPlusIcon className="h-10 w-10" />}
        text="Seus amigos vão aparecer aqui quando aceitarem o pedido."
      />
    </>
  )
}

function OnlineTab(p: TabBodyProps): React.JSX.Element {
  return <FriendsListTab kind="online" {...p} />
}

function AllTab(p: TabBodyProps): React.JSX.Element {
  return <FriendsListTab kind="all" {...p} />
}

function NoTab(): null {
  return null
}

/** Conteúdo de cada aba da tela de Amigos. */
export const TAB_BODIES: Record<FriendsTab, ComponentType<TabBodyProps>> = {
  online: OnlineTab,
  all: AllTab,
  pending: PendingTab,
  invites: NoTab,
  blocked: BlockedTab,
  add: AddTab
}
