import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../../auth/store/authStore'
import { serverDisplayName } from '../lib/serverNames'
import { useServerStore } from '../store/serverStore'
import { useUIStore } from '../../../shared/store/uiStore'
import { useServerAccess } from '../hooks/useServerAccess'
import { useServerSettingsStore } from '../store/serverSettingsStore'
import { useModerationStore } from '../../call/store/moderationStore'
import { Perm } from '../lib/permissions'
import { canOpenServerSettings } from '../lib/serverSettingsNav'
import { actionErrorMessage } from '../lib/permissionErrors'
import { useChatStore } from '../../chat/store/chatStore'
import { useNotifySettingsStore } from '../../notifications/store/notifySettingsStore'
import { resolveScope } from '../../notifications/lib/notificationMute'
import { useNow } from '../../../shared/hooks/useNow'
import { useCallStore } from '../../call/store/callStore'
import { useLevelStore } from '../../levels/store/levelStore'
import type { Channel, ChannelType } from '../api/channels'
import { listActiveServerCalls, type CallStateResponse } from '../../call/api/calls'
import {
  channelDragType,
  dropInsertionIndex,
  insertionToTarget,
  isNoopDrop,
  moveItem
} from '../lib/channelOrder'
import { showToast } from '../../../shared/store/toastStore'
import Modal from '../../../shared/ui/Modal'
import Button from '../../../shared/ui/Button'
import Input from '../../../shared/ui/Input'
import SidebarFooter from '../../../app/SidebarFooter'
import ChannelPermissionsModal from './ChannelPermissionsModal'
import ConfirmModal from '../../friends/components/ConfirmModal'
import Switch from '../../../shared/ui/Switch'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  GearIcon,
  LockIcon,
  UserPlusIcon,
  PlusIcon,
  PencilIcon,
  StarIcon,
  TrashIcon,
  VolumeIcon
} from '../../../shared/ui/icons'
import { setPrimaryChannel } from '../api/servers'
import { primaryChannelId } from '../lib/primaryChannel'
import ResizeHandle from '../../../shared/ui/ResizeHandle'
import { useResizableWidth } from '../../../shared/hooks/useResizableWidth'
import { ChannelListSkeleton } from '../../../shared/ui/skeleton/layouts'
import { WRAP_NAME } from '../lib/voiceChannelRow'
import VoiceChannelRow from './VoiceChannelRow'
import { Skeleton } from '../../../shared/ui/skeleton/Skeleton'

export function ServerSidebar(): React.JSX.Element {
  const navigate = useNavigate()
  const { channelId } = useParams<{ channelId: string }>()

  const user = useAuthStore((s) => s.user)
  const currentServer = useServerStore((s) => s.currentServer)
  const roles = useServerStore((s) => s.roles)
  const channels = useServerStore((s) => s.channels)
  const channelsLoadedFor = useServerStore((s) => s.channelsLoadedFor)
  const createChannel = useServerStore((s) => s.createChannel)
  const updateChannel = useServerStore((s) => s.updateChannel)
  const deleteChannel = useServerStore((s) => s.deleteChannel)
  const deleteServer = useServerStore((s) => s.deleteServer)
  const unreadByRoom = useChatStore((s) => s.unreadByRoom)
  const mentionsByRoom = useChatStore((s) => s.mentionsByRoom)
  const notifyServers = useNotifySettingsStore((s) => s.servers)
  const notifyChannels = useNotifySettingsStore((s) => s.channels)
  const openNotifyModal = useNotifySettingsStore((s) => s.openModal)
  const now = useNow()
  const openInviteModal = useUIStore((s) => s.openServerInviteModal)
  const createChannelModalOpen = useUIStore((s) => s.createChannelModalOpen)
  const openCreateChannelModal = useUIStore((s) => s.openCreateChannelModal)
  const closeCreateChannelModal = useUIStore((s) => s.closeCreateChannelModal)

  const callListVersion = useCallStore((s) => s.listVersion)
  const serverCalls = useCallStore((s) => s.serverCalls)
  const joinVoiceChannel = useCallStore((s) => s.joinVoiceChannel)
  const admittedChannelId = useCallStore((s) => s.admittedChannelId)
  const clearAdmittedChannel = useCallStore((s) => s.clearAdmittedChannel)
  const ensureLevels = useLevelStore((s) => s.ensureLevels)

  // Mesma preferência de largura na barra de canais e na de DMs/amigos.
  const sidebar = useResizableWidth('channels')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [channelName, setChannelName] = useState('')
  const [channelType, setChannelType] = useState<ChannelType>('text')
  const [creatingChannel, setCreatingChannel] = useState(false)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [channelMenuFor, setChannelMenuFor] = useState<string | null>(null)
  const channelMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (channelMenuFor === null) return
    const onDown = (e: MouseEvent): void => {
      const target = e.target as Element | null
      if (
        !target ||
        channelMenuRef.current?.contains(target) ||
        target.closest('[data-channel-menu-button]')
      )
        return
      setChannelMenuFor(null)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setChannelMenuFor(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [channelMenuFor])
  const [deletingChannel, setDeletingChannel] = useState<Channel | null>(null)
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null)
  const [deleteServerOpen, setDeleteServerOpen] = useState(false)
  const [leaveServerOpen, setLeaveServerOpen] = useState(false)
  const [deletingServer, setDeletingServer] = useState(false)
  /** Canal novo privado: só estes cargos (e quem criou) veem. */
  const [channelPrivate, setChannelPrivate] = useState(false)
  const [channelRoleIds, setChannelRoleIds] = useState<string[]>([])
  /** Canal cujas permissões estão abertas no editor. */
  const [permissionsFor, setPermissionsFor] = useState<Channel | null>(null)

  // `channels` é o do servidor anterior até a busca do atual voltar: só mostra
  // a lista quando for deste servidor (ou já tiver canais dele).
  const channelsReady =
    Boolean(currentServer) &&
    (channelsLoadedFor === currentServer?.id ||
      channels.some((c) => c.server_id === currentServer?.id))
  const shownChannels = channelsReady ? channels : []
  const textChannels = shownChannels.filter((ch) => (ch.type ?? 'text') === 'text')
  const primaryId = primaryChannelId(currentServer, channels)
  const voiceChannels = shownChannels.filter((ch) => ch.type === 'voice')

  // Quem pode o quê vem dos cargos; o servidor confere de novo a cada ação.
  const access = useServerAccess()
  const canManageChannels = access.can(Perm.MANAGE_CHANNELS)
  const isOwner = access.isOwner
  /**
   * Canal de texto: todo membro abre o menu (notificações). Canal de voz: só
   * quem gerencia canais ou as permissões dele. Cada item de moderação se
   * esconde sozinho sem a permissão.
   */
  const canOpenChannelMenu = (ch: Channel): boolean =>
    (ch.type ?? 'text') === 'text' ||
    canManageChannels ||
    access.canInChannel(ch.id, Perm.MANAGE_ROLES)

  // Reordenar canais arrastando (dono/moderadores), cada um na sua seção.
  /** Canal sendo arrastado. */
  const [channelDrag, setChannelDrag] = useState<{ id: string; type: ChannelType } | null>(null)
  /** Onde aparece a linha de soltar: índice de inserção (0..n) na seção. */
  const [channelDropAt, setChannelDropAt] = useState<{
    type: ChannelType
    index: number
  } | null>(null)
  const sectionOf = (type: ChannelType): Channel[] =>
    type === 'text' ? textChannels : voiceChannels

  /** Muda a ordem na hora; se o servidor recusar, volta e avisa. */
  const reorderSection = async (type: ChannelType, from: number, to: number): Promise<void> => {
    if (!currentServer || from === to) return
    const ids = moveItem(
      sectionOf(type).map((c) => c.id),
      from,
      to
    )
    try {
      await useServerStore.getState().reorderChannels(currentServer.id, type, ids)
    } catch {
      showToast.error('Não foi possível mudar a ordem dos canais.')
    }
  }

  /** Props da linha do canal que pode ser arrastada (nada para quem não pode). */
  const channelDragSource = (
    ch: Channel,
    type: ChannelType
  ): React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean } =>
    canManageChannels
      ? {
          draggable: true,
          onDragStart: (e) => {
            e.dataTransfer.setData(channelDragType(type), ch.id)
            e.dataTransfer.effectAllowed = 'move'
            setChannelMenuFor(null)
            setChannelDrag({ id: ch.id, type })
          },
          onDragEnd: () => {
            setChannelDrag(null)
            setChannelDropAt(null)
          }
        }
      : {}

  /** Insere antes (metade de cima do bloco do canal) ou depois (de baixo). */
  const insertionAt = (e: React.DragEvent<HTMLElement>, index: number): number => {
    const rect = e.currentTarget.getBoundingClientRect()
    return dropInsertionIndex(index, e.clientY - rect.top, rect.height)
  }

  /** Bloco do canal como alvo de soltar outro canal da mesma seção. */
  const channelDropTarget = (
    type: ChannelType,
    index: number
  ): {
    onDragOver: (e: React.DragEvent<HTMLElement>) => void
    onDrop: (e: React.DragEvent<HTMLElement>) => void
  } => ({
    onDragOver: (e) => {
      if (!canManageChannels || !e.dataTransfer.types.includes(channelDragType(type))) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      const insertion = insertionAt(e, index)
      const from = channelDrag ? sectionOf(type).findIndex((c) => c.id === channelDrag.id) : -1
      const next = from >= 0 && isNoopDrop(from, insertion) ? null : { type, index: insertion }
      setChannelDropAt((cur) =>
        cur?.type === next?.type && cur?.index === next?.index ? cur : next
      )
    },
    onDrop: (e) => {
      const id = e.dataTransfer.getData(channelDragType(type))
      if (!canManageChannels || !id) return
      e.preventDefault()
      const insertion = insertionAt(e, index)
      const from = sectionOf(type).findIndex((c) => c.id === id)
      setChannelDrag(null)
      setChannelDropAt(null)
      if (from < 0 || isNoopDrop(from, insertion)) return
      void reorderSection(type, from, insertionToTarget(from, insertion))
    }
  })

  /** Linha de soltar acima (ou, no último canal, abaixo) do bloco. */
  const dropLine = (type: ChannelType, index: number, last: boolean): React.JSX.Element | null => {
    if (channelDropAt?.type !== type) return null
    const before = channelDropAt.index === index
    const after = last && channelDropAt.index === index + 1
    if (!before && !after) return null
    return (
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-1 z-20 h-0.5 rounded-full bg-violet-500 shadow-[0_0_6px_rgba(139,92,246,0.8)] ${
          before ? '-top-0.5' : '-bottom-0.5'
        }`}
      />
    )
  }

  /** Saiu da seção arrastando: some a linha. */
  const clearDropOnLeave = (e: React.DragEvent<HTMLElement>): void => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setChannelDropAt(null)
  }

  // A sala do servidor (eventos, menções, não lidas) é assinada pela
  // ServerRail para todos os servidores — sair desta tela não a cancela.

  // Chamadas ativas do servidor (conectados nos canais de voz) — estado
  // compartilhado no callStore para a view principal também consumir.
  useEffect(() => {
    const serverId = currentServer?.id
    if (!serverId) return
    let cancelled = false
    const refresh = (): void => {
      listActiveServerCalls(serverId)
        .then((states) => {
          if (cancelled) return
          const map: Record<string, CallStateResponse> = {}
          for (const st of states) {
            if (st.call?.channel_id) map[st.call.channel_id] = st
          }
          useCallStore.getState().setServerCalls(map)
        })
        .catch(() => {})
    }
    refresh()
    const timer = setInterval(refresh, 10000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [currentServer?.id, callListVersion])

  // Níveis de todo mundo nos canais de voz num pedido só: a lista é ordenada
  // por nível e assim reordena uma vez quando chegam, não a cada badge.
  const voiceUserIdsKey = Object.values(serverCalls)
    .flatMap((entry) => entry.participants.map((p) => p.user_id))
    .sort()
    .join(',')
  useEffect(() => {
    if (voiceUserIdsKey) ensureLevels(voiceUserIdsKey.split(','))
  }, [voiceUserIdsKey, ensureLevels])

  // Se nosso pedido para entrar na sala trancada foi aceito, navegamos para o canal automaticamente
  useEffect(() => {
    if (admittedChannelId && currentServer?.id) {
      navigate(`/servers/${currentServer.id}/channels/${admittedChannelId}`)
      clearAdmittedChannel()
    }
  }, [admittedChannelId, currentServer?.id, navigate, clearAdmittedChannel])

  const handleVoiceClick = (ch: Channel): void => {
    if (!access.canInChannel(ch.id, Perm.CONNECT)) {
      showToast.error('Você não tem permissão para entrar neste canal de voz.')
      return
    }
    // Estilo Discord: conectar ao canal e exibir a view de voz na área principal.
    joinVoiceChannel(ch.id)
      .then(() => {
        if (currentServer?.id) navigate(`/servers/${currentServer.id}/channels/${ch.id}`)
      })
      .catch((err) => {
        showToast.error(err instanceof Error ? err.message : 'Falha ao conectar ao canal de voz.')
      })
  }

  const handleSaveChannel = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const name = channelName.trim().toLowerCase().replace(/\s+/g, '-')
    if (!name || creatingChannel || !currentServer) return
    setCreatingChannel(true)
    try {
      if (editingChannel) {
        await updateChannel(currentServer.id, editingChannel.id, name)
        useChatStore.getState().fetchChannelsForServers([currentServer.id])
        closeCreateChannelModal()
        setChannelName('')
        setEditingChannel(null)
        showToast.success('Canal atualizado!')
      } else {
        await createChannel(currentServer.id, name, channelType, {
          private: channelPrivate,
          roleIds: channelRoleIds
        })
        useChatStore.getState().fetchChannelsForServers([currentServer.id])
        closeCreateChannelModal()
        setChannelName('')
        setChannelPrivate(false)
        setChannelRoleIds([])
        showToast.success(
          channelType === 'voice' ? `Canal de voz ${name} criado!` : `Canal #${name} criado!`
        )
      }
    } catch (err) {
      showToast.error(actionErrorMessage(err, 'Falha ao salvar canal.'))
    } finally {
      setCreatingChannel(false)
    }
  }

  const handleDeleteChannel = async (): Promise<void> => {
    if (!currentServer || !deletingChannel) return
    setDeletingChannelId(deletingChannel.id)
    try {
      await deleteChannel(currentServer.id, deletingChannel.id)
      useChatStore.getState().fetchChannelsForServers([currentServer.id])
      setDeletingChannel(null)
      showToast.success('Canal deletado!')
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Falha ao deletar canal.')
    } finally {
      setDeletingChannelId(null)
    }
  }

  const handleDeleteServer = async (): Promise<void> => {
    if (!currentServer || deletingServer) return
    setDeletingServer(true)
    try {
      await deleteServer(currentServer.id)
      useChatStore.getState().handleServerDeleted(currentServer.id)
      setDeleteServerOpen(false)
      navigate('/friends')
      showToast.success('Servidor deletado!')
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Falha ao deletar servidor.')
    } finally {
      setDeletingServer(false)
    }
  }

  const serverName = currentServer?.name ?? 'Servidor'

  /** Botão direito no canal abre o mesmo menu do "•••" (moderadores). */
  const channelContextMenu = (ch: Channel): ((e: React.MouseEvent) => void) | undefined =>
    canOpenChannelMenu(ch)
      ? (e) => {
          e.preventDefault()
          setChannelMenuFor(ch.id)
        }
      : undefined

  /** `onHover`: só aparece com o mouse em cima (fica no lugar da contagem). */
  const channelMenuButton = (ch: Channel, onHover = false): React.JSX.Element => (
    <button
      onClick={() => setChannelMenuFor(channelMenuFor === ch.id ? null : ch.id)}
      data-channel-menu-button=""
      aria-label="Opções do canal"
      title="Opções do canal"
      className={`absolute right-1.5 top-1.5 z-10 flex h-5 items-center rounded-md px-0.5 text-gray-500 transition-[color,background-color,opacity] hover:bg-fg/10 hover:text-strong cursor-pointer ${
        onHover && channelMenuFor !== ch.id
          ? 'opacity-0 group-hover/voicech:opacity-100 focus-visible:opacity-100'
          : ''
      }`}
    >
      <span className="text-[10px] leading-none">•••</span>
    </button>
  )

  const makePrimary = async (ch: Channel): Promise<void> => {
    if (!currentServer) return
    setChannelMenuFor(null)
    try {
      const updated = await setPrimaryChannel(currentServer.id, ch.id)
      useServerStore.getState().updateLocalServer(updated)
      showToast.success(`#${ch.name} agora é o canal principal.`)
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : 'Não foi possível mudar o canal principal.'
      )
    }
  }

  const channelMenu = (ch: Channel): React.JSX.Element => {
    const type: ChannelType = (ch.type ?? 'text') === 'voice' ? 'voice' : 'text'
    const section = sectionOf(type)
    const index = section.findIndex((c) => c.id === ch.id)
    const move = (to: number) => () => {
      setChannelMenuFor(null)
      void reorderSection(type, index, to)
    }
    return (
      <div
        ref={channelMenuRef}
        className="absolute right-1.5 top-full z-30 mt-1 flex w-48 flex-col rounded-xl border border-subtle bg-floating p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in"
      >
        {currentServer && (ch.type ?? 'text') === 'text' && (
          <button
            onClick={() => {
              setChannelMenuFor(null)
              openNotifyModal({ serverId: currentServer.id, channelId: ch.id, name: ch.name })
            }}
            className="flex items-center justify-between rounded-lg px-2.5 py-2 text-ds-sm font-medium text-gray-200 hover:bg-fg/10 cursor-pointer"
          >
            <span>Notificações do canal</span>
          </button>
        )}
        {/* Alternativa ao arrastar (teclado/leitor de tela). */}
        {canManageChannels && index > 0 && (
          <button
            onClick={move(index - 1)}
            className="flex items-center justify-between rounded-lg px-2.5 py-2 text-ds-sm font-medium text-gray-200 hover:bg-fg/10 cursor-pointer"
          >
            <span>Mover para cima</span>
            <ChevronUpIcon className="h-3.5 w-3.5" />
          </button>
        )}
        {canManageChannels && index >= 0 && index < section.length - 1 && (
          <button
            onClick={move(index + 1)}
            className="flex items-center justify-between rounded-lg px-2.5 py-2 text-ds-sm font-medium text-gray-200 hover:bg-fg/10 cursor-pointer"
          >
            <span>Mover para baixo</span>
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
        )}
        {access.can(Perm.MANAGE_SERVER) &&
          (ch.type ?? 'text') === 'text' &&
          ch.id !== primaryId && (
            <button
              onClick={() => void makePrimary(ch)}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-ds-sm font-medium text-gray-200 hover:bg-fg/10 cursor-pointer"
            >
              <span>Definir como principal</span>
              <StarIcon className="h-3.5 w-3.5 text-amber-400" />
            </button>
          )}
        {canManageChannels && !ch.is_system && (
          <button
            onClick={() => {
              setChannelMenuFor(null)
              setChannelName(ch.name)
              setEditingChannel(ch)
              openCreateChannelModal()
            }}
            className="flex items-center justify-between rounded-lg px-2.5 py-2 text-ds-sm font-medium text-gray-200 hover:bg-fg/10 cursor-pointer"
          >
            <span>Editar canal</span>
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
        )}
        {access.canInChannel(ch.id, Perm.MANAGE_ROLES) && !ch.is_system && (
          <button
            onClick={() => {
              setChannelMenuFor(null)
              setPermissionsFor(ch)
            }}
            className="flex items-center justify-between rounded-lg px-2.5 py-2 text-ds-sm font-medium text-gray-200 hover:bg-fg/10 cursor-pointer"
          >
            <span>Permissões</span>
            <LockIcon className="h-3.5 w-3.5" />
          </button>
        )}
        {canManageChannels && !ch.is_system && (
          <button
            onClick={() => {
              setChannelMenuFor(null)
              setDeletingChannel(ch)
            }}
            className="flex items-center justify-between rounded-lg px-2.5 py-2 text-ds-sm font-medium text-red-400 hover:bg-red-500/15 cursor-pointer"
          >
            <span>Deletar canal</span>
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      {/* z-10: a alça de redimensionar passa um pouco da borda, sobre o conteúdo. */}
      <aside
        style={sidebar.panelStyle}
        className="relative z-10 flex h-full shrink-0 flex-col border-r border-subtle bg-secondary backdrop-blur-2xl"
      >
        <ResizeHandle {...sidebar.handleProps} />
        {/* Top Server Header with Dropdown */}
        <div className="relative flex h-14 shrink-0 items-center justify-between px-4 border-b border-subtle shadow-xs">
          <button
            onClick={() => setDropdownOpen((d) => !d)}
            title={serverName}
            className="flex w-full min-w-0 items-center justify-between gap-1 text-left text-ds-md font-semibold text-strong hover:text-gray-200 cursor-pointer"
          >
            {/* Até duas linhas (o cabeçalho tem altura fixa); o resto no title. */}
            {currentServer ? (
              <span className={`line-clamp-2 min-w-0 leading-5 ${WRAP_NAME}`}>{serverName}</span>
            ) : (
              // Sem servidor ainda (abrindo): o nome real entra no lugar da barra.
              <span className="flex h-5 min-w-0 flex-1 items-center">
                <Skeleton className="h-3.5 w-3/5" />
                <span className="sr-only">Carregando servidor…</span>
              </span>
            )}
            <span className="shrink-0 text-xs text-gray-400">▼</span>
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute top-14 left-3 right-3 z-30 flex flex-col rounded-xl border border-subtle bg-floating p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2">
              {/* Quem tem CREATE_INVITE convida (por padrão, todo membro). */}
              {access.can(Perm.CREATE_INVITE) && (
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    openInviteModal()
                  }}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 text-ds-sm font-medium text-violet-300 hover:bg-violet-600/20 hover:text-violet-200 cursor-pointer"
                >
                  <span>Convidar pessoas</span>
                  <UserPlusIcon className="h-4 w-4" />
                </button>
              )}
              {/* O próprio apelido neste servidor ("Alterar apelido", todo mundo por padrão). */}
              {user && access.canChangeNickname(user.id) && (
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    if (!currentServer) return
                    const mine = useServerStore
                      .getState()
                      .currentMembers.find((m) => m.user_id === user.id)
                    const displayName = user.display_name || user.username
                    useModerationStore.getState().askNickname({
                      serverId: currentServer.id,
                      userId: user.id,
                      name: serverDisplayName(mine, user),
                      nickname: mine?.nickname ?? null,
                      displayName,
                      self: true
                    })
                  }}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 text-ds-sm font-medium text-gray-200 hover:bg-fg/10 cursor-pointer"
                >
                  <span>Alterar apelido</span>
                  <PencilIcon className="h-3.5 w-3.5" />
                </button>
              )}
              {currentServer && (
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    openNotifyModal({ serverId: currentServer.id, name: currentServer.name })
                  }}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 text-ds-sm font-medium text-gray-200 hover:bg-fg/10 cursor-pointer"
                >
                  <span>Notificações do servidor</span>
                </button>
              )}
              {canOpenServerSettings(access.perms) && (
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    useServerSettingsStore.getState().openSettings()
                  }}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 text-ds-sm font-medium text-gray-200 hover:bg-fg/10 cursor-pointer"
                >
                  <span>Configurações do servidor</span>
                  <GearIcon className="h-3.5 w-3.5" />
                </button>
              )}
              {!isOwner && (
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    setLeaveServerOpen(true)
                  }}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 text-ds-sm font-medium text-red-400 hover:bg-red-500/15 cursor-pointer"
                >
                  <span>Sair do servidor</span>
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              )}
              {isOwner && (
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    setDeleteServerOpen(true)
                  }}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 text-ds-sm font-medium text-red-400 hover:bg-red-500/15 cursor-pointer"
                >
                  <span>Deletar servidor</span>
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {/* Canais de texto */}
          <div>
            <div className="flex items-center justify-between px-2">
              <p className="text-ds-sm font-medium text-gray-400">Canais de texto</p>
              {canManageChannels && (
                <button
                  onClick={() => {
                    setEditingChannel(null)
                    setChannelName('')
                    setChannelType('text')
                    setChannelPrivate(false)
                    setChannelRoleIds([])
                    openCreateChannelModal()
                  }}
                  title="Criar canal de texto"
                  aria-label="Criar canal de texto"
                  className="cursor-pointer rounded-md p-0.5 text-gray-400 transition-colors hover:bg-fg/10 hover:text-strong"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-1 flex flex-col gap-0.5" onDragLeave={clearDropOnLeave}>
              {!channelsReady && <ChannelListSkeleton count={6} />}
              {channelsReady && textChannels.length === 0 && (
                <p className="px-2 text-ds-sm text-gray-500 italic">Nenhum canal ainda.</p>
              )}
              {textChannels.map((ch, index) => {
                const active = ch.id === channelId
                const muted = resolveScope(
                  currentServer ? notifyServers[currentServer.id] : undefined,
                  notifyChannels[ch.id],
                  now
                ).muted
                const mentions = mentionsByRoom[`channel:${ch.id}`] ?? 0
                const unread = muted ? 0 : (unreadByRoom[`channel:${ch.id}`] ?? 0)
                return (
                  <div
                    key={ch.id}
                    className={`relative transition-opacity ${
                      channelDrag?.id === ch.id ? 'opacity-40' : ''
                    }`}
                    {...channelDragSource(ch, 'text')}
                    {...channelDropTarget('text', index)}
                  >
                    {dropLine('text', index, index === textChannels.length - 1)}
                    <button
                      onClick={() => navigate(`/servers/${currentServer?.id}/channels/${ch.id}`)}
                      onContextMenu={channelContextMenu(ch)}
                      title={ch.name}
                      className={`flex w-full items-start gap-2 rounded-lg py-1 pl-2.5 text-left text-ds-md font-medium transition-all cursor-pointer ${
                        canOpenChannelMenu(ch) ? 'pr-7' : 'pr-2.5'
                      } ${
                        active
                          ? 'bg-fg/10 text-strong shadow-sm'
                          : 'text-gray-400 hover:bg-fg/6 hover:text-gray-200'
                      } ${muted && !active && mentions === 0 ? 'opacity-50' : ''}`}
                    >
                      <span className="flex h-6 shrink-0 items-center text-xl leading-none text-gray-500">
                        #
                      </span>
                      {/* Nome inteiro, quebrando linha; a estrela segue o texto. */}
                      <span className={`min-w-0 flex-1 leading-6 ${WRAP_NAME}`}>
                        {ch.name}
                        {access.isPrivate(ch.id) && (
                          <span
                            title="Canal privado"
                            className="ml-1.5 inline-flex align-[-1px] text-gray-500"
                          >
                            <LockIcon className="h-3 w-3" />
                            <span className="sr-only">(canal privado)</span>
                          </span>
                        )}
                        {ch.id === primaryId && (
                          <span
                            title="Canal principal: avisos do servidor são enviados aqui"
                            className="ml-1.5 inline-flex align-[-1px] text-amber-400/90"
                          >
                            <StarIcon className="h-3 w-3" />
                            <span className="sr-only">(canal principal)</span>
                          </span>
                        )}
                      </span>
                      {(mentions > 0 || unread > 0) && (
                        <span className="flex h-6 shrink-0 items-center">
                          <span
                            title={mentions > 0 ? 'Menções' : undefined}
                            className="rounded-full bg-red-500 px-1.5 py-0.2 text-[10px] font-bold text-white"
                          >
                            {(() => {
                              const n = mentions > 0 ? mentions : unread
                              return n > 99 ? '99+' : n
                            })()}
                          </span>
                        </span>
                      )}
                    </button>
                    {canOpenChannelMenu(ch) && channelMenuButton(ch)}
                    {channelMenuFor === ch.id && channelMenu(ch)}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Canais de voz */}
          <div>
            <div className="flex items-center justify-between px-2">
              <p className="text-ds-sm font-medium text-gray-400">Canais de voz</p>
              {canManageChannels && (
                <button
                  onClick={() => {
                    setEditingChannel(null)
                    setChannelName('')
                    setChannelType('voice')
                    setChannelPrivate(false)
                    setChannelRoleIds([])
                    openCreateChannelModal()
                  }}
                  title="Criar canal de voz"
                  aria-label="Criar canal de voz"
                  className="cursor-pointer rounded-md p-0.5 text-gray-400 transition-colors hover:bg-fg/10 hover:text-strong"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-1 flex flex-col gap-0.5" onDragLeave={clearDropOnLeave}>
              {!channelsReady && <ChannelListSkeleton count={3} offset={4} />}
              {channelsReady && voiceChannels.length === 0 && (
                <p className="px-2 text-ds-sm text-gray-500 italic">Nenhum canal de voz ainda.</p>
              )}
              {voiceChannels.map((ch, index) => (
                <VoiceChannelRow
                  key={ch.id}
                  channel={ch}
                  access={access}
                  dragging={channelDrag?.id === ch.id}
                  dropLine={dropLine('voice', index, index === voiceChannels.length - 1)}
                  dropTarget={channelDropTarget('voice', index)}
                  dragSource={channelDragSource(ch, 'voice')}
                  onJoin={() => handleVoiceClick(ch)}
                  onContextMenu={channelContextMenu(ch)}
                  renderMenuButton={
                    canOpenChannelMenu(ch) ? (onHover) => channelMenuButton(ch, onHover) : undefined
                  }
                  menu={channelMenuFor === ch.id ? channelMenu(ch) : null}
                />
              ))}
            </div>
          </div>
        </div>

        {/* "Voz conectada" na chamada + a barra do usuário (igual em todas as telas) */}
        <SidebarFooter />
      </aside>

      {/* Create / Edit Channel Modal */}
      <Modal
        open={createChannelModalOpen}
        title={`${editingChannel ? 'Editar' : 'Criar'} canal em ${currentServer?.name ?? 'servidor'}`}
        onClose={() => {
          closeCreateChannelModal()
          setEditingChannel(null)
          setChannelName('')
        }}
      >
        <form onSubmit={handleSaveChannel} className="space-y-4">
          <div>
            <label
              className="mb-1 block text-ds-sm font-medium text-gray-400"
              htmlFor="channel-name"
            >
              Nome do canal
            </label>
            <Input
              id="channel-name"
              placeholder="ex.: off-topic"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              autoFocus
              maxLength={32}
            />
          </div>
          {!editingChannel && (
            <div>
              <p className="mb-1 block text-ds-sm font-medium text-gray-400">Tipo do canal</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChannelType('text')}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-ds-md font-medium transition-colors ${
                    channelType === 'text'
                      ? 'border-violet-500 bg-violet-600/20 text-strong'
                      : 'border-subtle text-gray-400 hover:bg-fg/5'
                  }`}
                >
                  <span className="text-base leading-none">#</span>
                  Texto
                </button>
                <button
                  type="button"
                  onClick={() => setChannelType('voice')}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-ds-md font-medium transition-colors ${
                    channelType === 'voice'
                      ? 'border-success bg-success/15 text-strong'
                      : 'border-subtle text-gray-400 hover:bg-fg/5'
                  }`}
                >
                  <VolumeIcon className="h-4 w-4" />
                  Voz
                </button>
              </div>
            </div>
          )}
          {!editingChannel && (
            <div className="rounded-lg border border-subtle bg-fg/3 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-ds-md font-medium text-strong">Canal privado</p>
                  <p className="text-ds-sm text-gray-400">
                    {channelType === 'voice'
                      ? 'Só os cargos escolhidos (e você) veem e entram neste canal.'
                      : 'Só os cargos escolhidos (e você) veem este canal.'}
                  </p>
                </div>
                <Switch
                  checked={channelPrivate}
                  label="Canal privado"
                  onChange={setChannelPrivate}
                />
              </div>
              {channelPrivate && (
                <div className="mt-3 border-t border-subtle pt-3">
                  <p className="mb-2 text-ds-sm font-medium text-gray-400">Quem pode ver</p>
                  {roles.filter((r) => !r.is_default).length === 0 ? (
                    <p className="text-ds-sm text-gray-500">
                      Nenhum cargo ainda: só você e o dono vão ver. Crie cargos em Configurações do
                      servidor.
                    </p>
                  ) : (
                    <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                      {roles
                        .filter((r) => !r.is_default)
                        .map((r) => (
                          <li key={r.id}>
                            <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-ds-md text-gray-200 hover:bg-fg/5">
                              <input
                                type="checkbox"
                                checked={channelRoleIds.includes(r.id)}
                                onChange={(e) =>
                                  setChannelRoleIds((cur) =>
                                    e.target.checked
                                      ? [...cur, r.id]
                                      : cur.filter((id) => id !== r.id)
                                  )
                                }
                              />
                              <span className="truncate">{r.name}</span>
                            </label>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                closeCreateChannelModal()
                setEditingChannel(null)
                setChannelName('')
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={creatingChannel || !channelName.trim()}
            >
              {creatingChannel ? 'Salvando...' : editingChannel ? 'Salvar' : 'Criar canal'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Channel Confirm Modal */}
      <Modal
        open={deletingChannel !== null}
        title="Deletar canal"
        onClose={() => setDeletingChannel(null)}
      >
        <p className="text-ds-md text-gray-300">
          Tem certeza que deseja deletar o canal{' '}
          <b className="text-strong">#{deletingChannel?.name}</b>? Esta ação não pode ser desfeita e
          apagará todas as mensagens do canal.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeletingChannel(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={deletingChannelId !== null}
            onClick={() => void handleDeleteChannel()}
          >
            {deletingChannelId !== null ? 'Deletando...' : 'Deletar canal'}
          </Button>
        </div>
      </Modal>

      {/* Delete Server Confirm Modal */}
      <Modal
        open={deleteServerOpen}
        title="Deletar servidor"
        onClose={() => setDeleteServerOpen(false)}
      >
        <p className="text-ds-md text-gray-300">
          Tem certeza que deseja deletar o servidor <b className="text-strong">{serverName}</b>?
          Todos os canais e mensagens serão apagados e todos os membros serão removidos. Esta ação
          não pode ser desfeita.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteServerOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={deletingServer}
            onClick={() => void handleDeleteServer()}
          >
            {deletingServer ? 'Deletando...' : 'Deletar servidor'}
          </Button>
        </div>
      </Modal>

      <ChannelPermissionsModal channel={permissionsFor} onClose={() => setPermissionsFor(null)} />

      <ConfirmModal
        open={leaveServerOpen}
        title={`Sair de ${serverName}`}
        confirmLabel="Sair do servidor"
        onClose={() => setLeaveServerOpen(false)}
        onConfirm={async () => {
          if (!currentServer) return
          try {
            await useServerStore.getState().leaveServer(currentServer.id)
            useChatStore.getState().handleServerDeleted(currentServer.id)
            navigate('/friends')
          } catch (err) {
            showToast.error(actionErrorMessage(err, 'Não foi possível sair do servidor.'))
          }
        }}
      >
        <p>
          Você sai de <b className="text-strong">{serverName}</b> e só volta com um novo convite.
        </p>
      </ConfirmModal>
    </>
  )
}

export default ServerSidebar
