import { useState } from 'react'
import type { Server } from '../api/servers'
import { useAuthStore } from '../../auth/store/authStore'
import { useModerationStore } from '../../call/store/moderationStore'
import { useNotifySettingsStore } from '../../notifications/store/notifySettingsStore'
import { useUIStore } from '../../../shared/store/uiStore'
import { Skeleton } from '../../../shared/ui/skeleton/Skeleton'
import { GearIcon, PencilIcon, TrashIcon, UserPlusIcon } from '../../../shared/ui/icons'
import { useServerStore } from '../store/serverStore'
import { useServerSettingsStore } from '../store/serverSettingsStore'
import { useChannelSidebarStore } from '../store/channelSidebarStore'
import { Perm } from '../lib/permissions'
import type { ServerAccess } from '../lib/serverAccess'
import { serverDisplayName } from '../lib/serverNames'
import { canOpenServerSettings } from '../lib/serverSettingsNav'
import { serverMenuItems, type ServerMenuItem } from '../lib/sidebarMenus'
import { WRAP_NAME } from '../lib/voiceChannelRow'
import SidebarMenuItem, { type SidebarMenuTone } from './SidebarMenuItem'
import ServerLevelCard from '../../serverlevel/components/ServerLevelCard'
import ServerLevelChip from '../../serverlevel/components/ServerLevelChip'
import ServerLevelModal from '../../serverlevel/components/ServerLevelModal'
import { useServerLevelModalStore } from '../../serverlevel/store/serverLevelModalStore'

const LOOK: Record<
  ServerMenuItem,
  { label: string; icon?: React.ReactNode; tone?: SidebarMenuTone }
> = {
  invite: {
    label: 'Convidar pessoas',
    icon: <UserPlusIcon className="h-4 w-4" />,
    tone: 'brand'
  },
  nickname: { label: 'Alterar apelido', icon: <PencilIcon className="h-3.5 w-3.5" /> },
  notifications: { label: 'Notificações do servidor' },
  settings: { label: 'Configurações do servidor', icon: <GearIcon className="h-3.5 w-3.5" /> },
  leave: { label: 'Sair do servidor', icon: <TrashIcon className="h-3.5 w-3.5" />, tone: 'danger' },
  delete: {
    label: 'Deletar servidor',
    icon: <TrashIcon className="h-3.5 w-3.5" />,
    tone: 'danger'
  }
}

type Me = NonNullable<ReturnType<typeof useAuthStore.getState>['user']>

/** Pede o meu apelido neste servidor (o mesmo diálogo da moderação). */
function askOwnNickname(server: Server, user: Me): void {
  const mine = useServerStore.getState().currentMembers.find((m) => m.user_id === user.id)
  useModerationStore.getState().askNickname({
    serverId: server.id,
    userId: user.id,
    name: serverDisplayName(mine, user),
    nickname: mine?.nickname ?? null,
    displayName: user.display_name || user.username,
    self: true
  })
}

/** O menu que abre no nome do servidor. */
export function ServerMenuItems({
  server,
  access,
  onPicked
}: {
  server: Server | null
  access: ServerAccess
  onPicked: () => void
}): React.JSX.Element {
  const user = useAuthStore((s) => s.user)
  const openInviteModal = useUIStore((s) => s.openServerInviteModal)
  const openNotifyModal = useNotifySettingsStore((s) => s.openModal)
  const openConfirm = useChannelSidebarStore((s) => s.openConfirm)
  const items = serverMenuItems({
    hasServer: Boolean(server),
    canInvite: access.can(Perm.CREATE_INVITE),
    canChangeOwnNickname: Boolean(user && access.canChangeNickname(user.id)),
    canOpenSettings: canOpenServerSettings(access.perms),
    isOwner: access.isOwner
  })
  // Os itens que dependem do servidor só aparecem com ele (hasServer).
  const actions: Record<ServerMenuItem, () => void> = {
    invite: openInviteModal,
    nickname: () => server && user && askOwnNickname(server, user),
    notifications: () => server && openNotifyModal({ serverId: server.id, name: server.name }),
    settings: () => useServerSettingsStore.getState().openSettings(),
    leave: () => openConfirm('leave'),
    delete: () => openConfirm('delete-server')
  }
  return (
    <div className="absolute top-14 left-3 right-3 z-30 flex flex-col rounded-xl border border-subtle bg-floating p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2">
      {server && (
        <ServerLevelCard
          serverId={server.id}
          onOpen={() => {
            onPicked()
            useServerLevelModalStore.getState().open(server.id)
          }}
        />
      )}
      {items.map((item) => (
        <SidebarMenuItem
          key={item}
          {...LOOK[item]}
          onClick={() => {
            onPicked()
            actions[item]()
          }}
        />
      ))}
    </div>
  )
}

/** Nome do servidor no topo da barra; clicar abre o menu dele. */
function ServerHeaderMenu({
  server,
  access
}: {
  server: Server | null
  access: ServerAccess
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const name = server?.name ?? 'Servidor'
  return (
    <div className="relative flex h-14 shrink-0 items-center justify-between px-4 border-b border-subtle shadow-xs">
      <button
        onClick={() => setOpen((d) => !d)}
        title={name}
        className="flex w-full min-w-0 items-center justify-between gap-1 text-left text-ds-md font-semibold text-strong hover:text-gray-200 cursor-pointer"
      >
        {/* Até duas linhas (o cabeçalho tem altura fixa); o resto no title. */}
        {server ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={`line-clamp-2 min-w-0 leading-5 ${WRAP_NAME}`}>{name}</span>
            <ServerLevelChip serverId={server.id} />
          </span>
        ) : (
          // Sem servidor ainda (abrindo): o nome real entra no lugar da barra.
          <span className="flex h-5 min-w-0 flex-1 items-center">
            <Skeleton className="h-3.5 w-3/5" />
            <span className="sr-only">Carregando servidor…</span>
          </span>
        )}
        <span className="shrink-0 text-xs text-gray-400">▼</span>
      </button>
      {open && <ServerMenuItems server={server} access={access} onPicked={() => setOpen(false)} />}
      <ServerLevelModal />
    </div>
  )
}

export default ServerHeaderMenu
