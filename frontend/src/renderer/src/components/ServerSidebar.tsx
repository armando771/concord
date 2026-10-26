import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useServerNicknames } from '../store/useServerNames'
import { serverDisplayName } from '../lib/serverNames'
import { useServerStore } from '../store/serverStore'
import { useUIStore } from '../store/uiStore'
import { useServerAccess } from '../store/useServerAccess'
import { useServerSettingsStore } from '../store/serverSettingsStore'
import { useModerationStore } from '../store/moderationStore'
import { Perm } from '../lib/permissions'
import { canOpenServerSettings } from '../lib/serverSettingsNav'
import { actionErrorMessage } from '../lib/permissionErrors'
import { useChatStore } from '../store/chatStore'
import { useNotifySettingsStore } from '../store/notifySettingsStore'
import { resolveScope } from '../lib/notificationMute'
import { useNow } from './useNow'
import { useCallStore } from '../store/callStore'
import VoiceStateIcons from './call/VoiceStateIcons'
import VoiceChannelTimer from './call/VoiceChannelTimer'
import LiveBadge from './call/LiveBadge'
import { GameBadge } from './ActivityLine'
import { liveUserIds } from '../lib/liveBadge'
import { useUserAudioStore } from '../store/userAudioStore'
import { useLevelStore } from '../store/levelStore'
import { sortVoiceMembers } from '../lib/voiceOrder'
import { userMenuHandler } from '../store/userMenuStore'
import { profileCardHandler } from '../store/profileCardStore'
import type { Channel, ChannelType } from '../api/channels'
import { listActiveServerCalls, moveToVoiceChannel, type CallStateResponse } from '../api/calls'
import { canMoveVoiceUser, VOICE_USER_DRAG } from '../lib/voiceMove'
import {
  channelDragType,
  dropInsertionIndex,
  insertionToTarget,
  isNoopDrop,
  moveItem
} from '../lib/channelOrder'
import { showToast } from '../store/toastStore'
import Modal from './Modal'
import Button from './Button'
import Input from './Input'
import SidebarFooter from './SidebarFooter'
import ChannelPermissionsModal from './ChannelPermissionsModal'
import ConfirmModal from './friends/ConfirmModal'
import Switch from './Switch'
import Avatar from './Avatar'
import MaestroAvatar from './music/MaestroAvatar'
import { MAESTRO_NAME, maestroIdentity, T18 } from '../lib/music'
import { useMusicStore } from '../store/musicStore'
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
  VolumeIcon,
  VolumeOffIcon,
  XIcon
} from './icons'
import { setPrimaryChannel } from '../api/servers'
import { primaryChannelId } from '../lib/primaryChannel'
import ResizeHandle from './ResizeHandle'
import { useResizableWidth } from './useResizableWidth'
import StyledName from './StyledName'

/**
 * Nomes longos quebram linha em vez de cortar com "…" (o canal "predador-🐺-vs…"
 * aparecia pela metade). `anywhere` também quebra palavra gigante sem hífen.
 */
const WRAP_NAME = 'break-words [overflow-wrap:anywhere]'
const NO_CHANNELS: string[] = []

export function ServerSidebar(): React.JSX.Element {
  const navigate = useNavigate()
  const { channelId } = useParams<{ channelId: string }>()

  const user = useAuthStore((s) => s.user)
  const currentServer = useServerStore((s) => s.currentServer)
  const nicknames = useServerNicknames(currentServer?.id)
  // Canais de voz em que o Maestro está tocando (aparece na lista do canal).
  const maestroChannels = useMusicStore(
    (s) => (currentServer ? s.presence[currentServer.id] : undefined) ?? NO_CHANNELS
  )
  const openMusicPanel = useMusicStore((s) => s.openPanel)
  const roles = useServerStore((s) => s.roles)
  const channels = useServerStore((s) => s.channels)
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

  const callStatus = useCallStore((s) => s.status)
  const activeCallType = useCallStore((s) => s.type)
  const activeCallChannelId = useCallStore((s) => s.channelId)
  const callListVersion = useCallStore((s) => s.listVersion)
  const speakingIds = useCallStore((s) => s.speakingIds)
  const selfMuted = useCallStore((s) => s.muted)
  const selfDeafened = useCallStore((s) => s.deafened)
  const locallyMuted = useUserAudioStore((s) => s.settings)
  const serverCalls = useCallStore((s) => s.serverCalls)
  const screenSharers = useCallStore((s) => s.screenSharers)
  const joinVoiceChannel = useCallStore((s) => s.joinVoiceChannel)
  const knock = useCallStore((s) => s.knock)
  const cancelJoinRequest = useCallStore((s) => s.cancelJoinRequest)
  const admittedChannelId = useCallStore((s) => s.admittedChannelId)
  const clearAdmittedChannel = useCallStore((s) => s.clearAdmittedChannel)
  const levels = useLevelStore((s) => s.levels)
  const ensureLevels = useLevelStore((s) => s.ensureLevels)

  // Mesma preferência de largura na barra de canais e na de DMs/amigos.
  const sidebar = useResizableWidth('channels')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [channelName, setChannelName] = useState('')
  const [channelType, setChannelType] = useState<ChannelType>('text')
  const [creatingChannel, setCreatingChannel] = useState(false)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [channelMenuFor, setChannelMenuFor] = useState<string | null>(null)
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

  const textChannels = channels.filter((ch) => (ch.type ?? 'text') === 'text')
  const primaryId = primaryChannelId(currentServer, channels)
  const voiceChannels = channels.filter((ch) => ch.type === 'voice')

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
  /** Canal de voz sobre o qual alguém está sendo arrastado (moderadores). */
  const [voiceDropTarget, setVoiceDropTarget] = useState<string | null>(null)
  const canMove = (targetId: string, fromChannelId: string): boolean =>
    canMoveVoiceUser({
      meId: user?.id,
      targetId,
      canMoveMembers: access.canInChannel(fromChannelId, Perm.MOVE_MEMBERS),
      canActOnTarget: access.canActOnMember(targetId)
    })
  const moveUser = async (userId: string, channelId: string): Promise<void> => {
    try {
      await moveToVoiceChannel(userId, channelId)
    } catch (err) {
      showToast.error(actionErrorMessage(err, 'Não foi possível mover.'))
    }
  }

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
      <>
        <div className="fixed inset-0 z-20" onClick={() => setChannelMenuFor(null)} />
        <div className="absolute right-1.5 top-full z-30 mt-1 flex w-48 flex-col rounded-xl border border-subtle bg-floating p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in">
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
      </>
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
            <span className={`line-clamp-2 min-w-0 leading-5 ${WRAP_NAME}`}>{serverName}</span>
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
              {textChannels.length === 0 && (
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
              {voiceChannels.length === 0 && (
                <p className="px-2 text-ds-sm text-gray-500 italic">Nenhum canal de voz ainda.</p>
              )}
              {voiceChannels.map((ch, index) => {
                const callState = serverCalls[ch.id]
                // O backend manda em ordem de entrada; aqui vale nível (ver voiceOrder).
                const participants = sortVoiceMembers(callState?.participants ?? [], (p) => ({
                  id: p.user_id,
                  name: serverDisplayName({ nickname: nicknames?.[p.user_id] }, p),
                  level: levels[p.user_id],
                  joinedAt: p.joined_at
                }))
                const connectedHere =
                  callStatus !== 'idle' &&
                  activeCallType === 'channel' &&
                  activeCallChannelId === ch.id
                const live = liveUserIds(callState, connectedHere ? screenSharers : [])
                const isLocked = Boolean(callState?.call?.locked)
                const isPendingKnock = knock?.channelId === ch.id && knock.status === 'pending'
                const isDeclinedKnock = knock?.channelId === ch.id && knock.status === 'declined'
                return (
                  <div
                    key={ch.id}
                    className={`relative transition-opacity ${
                      channelDrag?.id === ch.id ? 'opacity-40' : ''
                    }`}
                    onDragOver={(e) => {
                      // Arrastando um canal de voz (reordenar) ou uma pessoa (mover).
                      channelDropTarget('voice', index).onDragOver(e)
                      if (!e.dataTransfer.types.includes(VOICE_USER_DRAG)) return
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      setVoiceDropTarget(ch.id)
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                        setVoiceDropTarget((cur) => (cur === ch.id ? null : cur))
                      }
                    }}
                    onDrop={(e) => {
                      channelDropTarget('voice', index).onDrop(e)
                      const userId = e.dataTransfer.getData(VOICE_USER_DRAG)
                      setVoiceDropTarget(null)
                      if (!userId || participants.some((p) => p.user_id === userId)) return
                      e.preventDefault()
                      void moveUser(userId, ch.id)
                    }}
                  >
                    {/* O "•••" é absoluto, alinhado à primeira linha do nome: precisa ficar
                        preso à linha do canal, não ao bloco todo (que cresce com a lista). */}
                    {dropLine('voice', index, index === voiceChannels.length - 1)}
                    <div className="group/voicech relative" {...channelDragSource(ch, 'voice')}>
                      <button
                        onClick={() => handleVoiceClick(ch)}
                        onContextMenu={channelContextMenu(ch)}
                        title={
                          connectedHere
                            ? 'Desconectar'
                            : access.canInChannel(ch.id, Perm.CONNECT)
                              ? 'Conectar ao canal de voz'
                              : 'Você não tem permissão para entrar neste canal'
                        }
                        className={`flex w-full items-start gap-2 rounded-lg py-1 pl-2.5 text-left text-ds-md font-medium transition-all cursor-pointer ${
                          access.canInChannel(ch.id, Perm.CONNECT) ? '' : 'opacity-60'
                        } ${
                          // Sem gente, o "•••" fica sempre à direita: guarda o espaço dele.
                          canOpenChannelMenu(ch) && participants.length === 0 ? 'pr-7' : 'pr-2.5'
                        } ${
                          voiceDropTarget === ch.id
                            ? 'bg-brand/25 text-strong ring-2 ring-brand'
                            : connectedHere
                              ? 'text-strong hover:bg-fg/6'
                              : 'text-gray-400 hover:bg-fg/6 hover:text-gray-200'
                        }`}
                      >
                        {/* Verde só nos canais com gente (pode ser em vários ao mesmo tempo). */}
                        <span className="flex h-6 shrink-0 items-center">
                          <VolumeIcon
                            className={`h-5 w-5 transition-colors ${
                              participants.length > 0 ? 'text-success' : 'text-gray-500'
                            }`}
                          />
                        </span>
                        {/* Nome inteiro, quebrando linha; tempo e contagem ficam na
                            altura da primeira linha. */}
                        <span title={ch.name} className={`min-w-0 flex-1 leading-6 ${WRAP_NAME}`}>
                          {ch.name}
                          {isLocked && (
                            <span
                              title="Sala trancada"
                              className="ml-1.5 inline-flex align-[-1px] text-amber-500/90"
                            >
                              <LockIcon className="h-3 w-3" />
                              <span className="sr-only">(trancada)</span>
                            </span>
                          )}
                          {(access.isPrivate(ch.id) ||
                            !access.canInChannel(ch.id, Perm.CONNECT)) && (
                            <span
                              title={
                                access.isPrivate(ch.id)
                                  ? 'Canal privado'
                                  : 'Sem permissão para entrar'
                              }
                              className="ml-1.5 inline-flex align-[-1px] text-gray-500"
                            >
                              <LockIcon className="h-3 w-3" />
                              <span className="sr-only">(restrito)</span>
                            </span>
                          )}
                        </span>
                        {participants.length > 0 && callState?.call?.started_at && (
                          <span className="flex h-6 shrink-0 items-center">
                            <VoiceChannelTimer startedAt={callState.call.started_at} />
                          </span>
                        )}
                        {participants.length > 0 && (
                          <span
                            className={`flex h-6 shrink-0 items-center transition-opacity ${
                              canOpenChannelMenu(ch) ? 'group-hover/voicech:opacity-0' : ''
                            }`}
                          >
                            <span className="rounded-full bg-fg/10 px-1.5 py-0.2 text-[10px] font-bold text-gray-300">
                              {participants.length}
                            </span>
                          </span>
                        )}
                      </button>
                      {/* Com gente no canal, o "•••" troca de lugar com a contagem no hover. */}
                      {canOpenChannelMenu(ch) && channelMenuButton(ch, participants.length > 0)}
                      {channelMenuFor === ch.id && channelMenu(ch)}

                      {/* Overlay para salas trancadas quando o usuário não está conectado nela */}
                      {isLocked &&
                        !connectedHere &&
                        (isPendingKnock ? (
                          <div className="absolute inset-0 z-10 flex items-center justify-between rounded-lg bg-amber-950/80 px-2.5 backdrop-blur-sm border border-amber-500/40 animate-in fade-in duration-150">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="h-2 w-2 shrink-0 animate-ping rounded-full bg-amber-400" />
                              <span className="truncate text-xs font-semibold text-amber-200">
                                Pedido enviado...
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                cancelJoinRequest()
                              }}
                              title="Cancelar pedido"
                              className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-fg/10 text-gray-300 hover:bg-fg/20 hover:text-strong"
                            >
                              <XIcon className="h-3 w-3" />
                            </button>
                          </div>
                        ) : isDeclinedKnock ? (
                          <div className="absolute inset-0 z-10 flex items-center gap-1.5 rounded-lg bg-red-950/80 px-2.5 backdrop-blur-sm border border-red-500/40 animate-in fade-in duration-150">
                            <XIcon className="h-3.5 w-3.5 text-red-400 shrink-0" />
                            <span className="truncate text-xs font-medium text-red-200">
                              Pedido recusado
                            </span>
                          </div>
                        ) : (
                          <div
                            onClick={() => handleVoiceClick(ch)}
                            className="pointer-events-none group-hover/voicech:pointer-events-auto absolute inset-0 z-10 flex items-center justify-center gap-1.5 rounded-lg bg-black/80 px-2 opacity-0 backdrop-blur-xs transition-opacity group-hover/voicech:opacity-100 cursor-pointer border border-amber-500/20 on-media"
                          >
                            <LockIcon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                            <span className="truncate text-xs font-semibold text-amber-200">
                              Sala trancada · Pedir permissão
                            </span>
                          </div>
                        ))}
                    </div>
                    {(participants.length > 0 || maestroChannels.includes(ch.id)) && (
                      <div className="mb-1 ml-4 flex flex-col gap-0.5">
                        {participants.map((p) => {
                          const name = serverDisplayName({ nickname: nicknames?.[p.user_id] }, p)
                          const isMe = p.user_id === user?.id
                          // Só sabemos quem fala no canal em que estamos conectados.
                          const talking = connectedHere && speakingIds.includes(p.user_id)
                          return (
                            <div
                              key={p.user_id}
                              onContextMenu={userMenuHandler(p.user_id, name, user?.id, p.username)}
                              onClick={profileCardHandler(p.user_id, name, p.username, 'right')}
                              draggable={canMove(p.user_id, ch.id)}
                              onDragStart={(e) => {
                                e.dataTransfer.setData(VOICE_USER_DRAG, p.user_id)
                                e.dataTransfer.effectAllowed = 'move'
                              }}
                              onDragEnd={() => setVoiceDropTarget(null)}
                              title={
                                canMove(p.user_id, ch.id)
                                  ? 'Arraste para outro canal de voz'
                                  : undefined
                              }
                              className={`group/voiceuser relative flex items-center gap-2 overflow-hidden rounded-md px-2 py-1 transition-colors ${
                                isMe ? 'bg-fg/5 hover:bg-fg/10' : 'hover:bg-fg/[0.06]'
                              } ${canMove(p.user_id, ch.id) ? 'cursor-pointer active:cursor-grabbing' : 'cursor-pointer'}`}
                            >
                              <Avatar
                                userId={p.user_id}
                                name={name}
                                avatarUrl={p.avatar_url}
                                size={24}
                                className={`rounded-full transition-shadow ${
                                  talking ? 'ring-2 ring-success' : ''
                                }`}
                              />
                              <span
                                title={name}
                                className={`min-w-0 truncate text-ds-sm transition-colors group-hover/voiceuser:text-strong ${
                                  isMe ? 'font-bold text-strong' : 'font-medium text-gray-300'
                                }`}
                              >
                                {nicknames?.[p.user_id] ? (
                                  name
                                ) : (
                                  <StyledName name={name} userId={p.user_id} style={p.name_style} />
                                )}
                              </span>
                              {/* Selo de nível só na lista de membros da direita; aqui o
                                  nível só ordena a lista (ver voiceOrder). */}
                              <span className="ml-auto flex items-center gap-0.5 pr-1">
                                <GameBadge userId={p.user_id} />
                                {live.has(p.user_id) && <LiveBadge />}
                                {!isMe && locallyMuted[p.user_id]?.muted && (
                                  <span title="Silenciado por você" className="text-gray-400">
                                    <VolumeOffIcon className="h-3.5 w-3.5" />
                                  </span>
                                )}
                                <VoiceStateIcons
                                  muted={isMe && connectedHere ? selfMuted : p.muted}
                                  deafened={isMe && connectedHere ? selfDeafened : p.deafened}
                                  serverMuted={p.server_muted}
                                  serverDeafened={p.server_deafened}
                                />
                              </span>
                            </div>
                          )
                        })}
                        {/* O Maestro aparece como mais alguém no canal; clicar nele
                            abre o painel "Tocando agora" (não o perfil). */}
                        {maestroChannels.includes(ch.id) && (
                          <div
                            onContextMenu={userMenuHandler(
                              maestroIdentity(ch.id),
                              MAESTRO_NAME,
                              user?.id
                            )}
                            onClick={() => {
                              openMusicPanel()
                              if (currentServer?.id && channelId !== ch.id) {
                                navigate(`/servers/${currentServer.id}/channels/${ch.id}`)
                              }
                            }}
                            className="group/voiceuser relative flex cursor-pointer items-center gap-2 overflow-hidden rounded-md px-2 py-1 transition-colors hover:bg-fg/[0.06]"
                          >
                            <MaestroAvatar size={24} />
                            <span className="min-w-0 truncate text-ds-sm font-medium text-gray-300 transition-colors group-hover/voiceuser:text-strong">
                              {MAESTRO_NAME}
                            </span>
                            <span className="ml-auto mr-1 rounded bg-violet-400/30 px-1 text-[9px] font-bold uppercase text-violet-100">
                              {T18.tag}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
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
