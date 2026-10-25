import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useServerStore } from '../store/serverStore'
import { useFriendStore } from '../store/friendStore'
import { useInviteStore } from '../store/inviteStore'
import { useUIStore } from '../store/uiStore'
import { useChatStore } from '../store/chatStore'
import { useCallStore } from '../store/callStore'
import VoiceStateIcons from './call/VoiceStateIcons'
import VoiceChannelTimer from './call/VoiceChannelTimer'
import LiveBadge from './call/LiveBadge'
import { liveUserIds } from '../lib/liveBadge'
import { useUserAudioStore } from '../store/userAudioStore'
import { userMenuHandler } from '../store/userMenuStore'
import { profileCardHandler } from '../store/profileCardStore'
import { logout } from '../api/auth'
import type { Channel, ChannelType } from '../api/channels'
import {
  listActiveServerCalls,
  moveToVoiceChannel,
  type CallStateResponse
} from '../api/calls'
import { canMoveVoiceUser, VOICE_USER_DRAG } from '../lib/voiceMove'
import { showToast } from '../store/toastStore'
import Modal from './Modal'
import Button from './Button'
import Input from './Input'
import VoiceConnectedPanel from './call/VoiceConnectedPanel'
import {
  GearIcon,
  UserPlusIcon,
  PlusIcon,
  PencilIcon,
  StarIcon,
  TrashIcon,
  VolumeIcon,
  VolumeOffIcon
} from './icons'
import { setPrimaryChannel } from '../api/servers'
import { primaryChannelId } from '../lib/primaryChannel'
import VoiceSettings from './VoiceSettings'
import AppSettings from './AppSettings'

export function ServerSidebar(): React.JSX.Element {
  const navigate = useNavigate()
  const { channelId } = useParams<{ channelId: string }>()

  const user = useAuthStore((s) => s.user)
  const clear = useAuthStore((s) => s.clear)
  const currentServer = useServerStore((s) => s.currentServer)
  const currentMembers = useServerStore((s) => s.currentMembers)
  const channels = useServerStore((s) => s.channels)
  const createChannel = useServerStore((s) => s.createChannel)
  const updateChannel = useServerStore((s) => s.updateChannel)
  const deleteChannel = useServerStore((s) => s.deleteChannel)
  const updateServer = useServerStore((s) => s.updateServer)
  const deleteServer = useServerStore((s) => s.deleteServer)
  const unreadByRoom = useChatStore((s) => s.unreadByRoom)
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

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [channelName, setChannelName] = useState('')
  const [channelType, setChannelType] = useState<ChannelType>('text')
  const [creatingChannel, setCreatingChannel] = useState(false)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [channelMenuFor, setChannelMenuFor] = useState<string | null>(null)
  const [deletingChannel, setDeletingChannel] = useState<Channel | null>(null)
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null)
  const [editServerOpen, setEditServerOpen] = useState(false)
  const [deleteServerOpen, setDeleteServerOpen] = useState(false)
  const [serverNameInput, setServerNameInput] = useState('')
  const [serverIconInput, setServerIconInput] = useState('')
  const [savingServer, setSavingServer] = useState(false)
  const [deletingServer, setDeletingServer] = useState(false)

  const textChannels = channels.filter((ch) => (ch.type ?? 'text') === 'text')
  const primaryId = primaryChannelId(currentServer, channels)
  const voiceChannels = channels.filter((ch) => ch.type === 'voice')

  const isAdmin =
    currentServer?.owner_id === user?.id ||
    currentMembers.some((m) => m.user_id === user?.id && m.role === 'admin')
  const isOwner = currentServer?.owner_id === user?.id
  /** Canal de voz sobre o qual alguém está sendo arrastado (moderadores). */
  const [voiceDropTarget, setVoiceDropTarget] = useState<string | null>(null)
  const canMove = (targetId: string): boolean =>
    canMoveVoiceUser({
      meId: user?.id,
      ownerId: currentServer?.owner_id,
      isModerator: isAdmin,
      targetId
    })
  const moveUser = async (userId: string, channelId: string): Promise<void> => {
    try {
      await moveToVoiceChannel(userId, channelId)
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Não foi possível mover.')
    }
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

  const handleVoiceClick = (ch: Channel): void => {
    // Estilo Discord: conectar ao canal e exibir a view de voz na área principal.
    joinVoiceChannel(ch.id)
      .then(() => {
        if (currentServer?.id) navigate(`/servers/${currentServer.id}/channels/${ch.id}`)
      })
      .catch((err) => {
        showToast.error(err instanceof Error ? err.message : 'Falha ao conectar ao canal de voz.')
      })
  }

  const handleLogout = async (): Promise<void> => {
    setLoggingOut(true)
    try {
      await logout()
    } catch {
      // Limpa sessão local
    } finally {
      useFriendStore.getState().reset()
      useServerStore.getState().reset()
      useInviteStore.getState().reset()
      useChatStore.getState().disconnect()
      clear()
      setSettingsOpen(false)
      navigate('/login')
    }
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
        await createChannel(currentServer.id, name, channelType)
        useChatStore.getState().fetchChannelsForServers([currentServer.id])
        closeCreateChannelModal()
        setChannelName('')
        showToast.success(
          channelType === 'voice' ? `Canal de voz ${name} criado!` : `Canal #${name} criado!`
        )
      }
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Falha ao salvar canal.')
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

  const openEditServer = (): void => {
    setServerNameInput(currentServer?.name ?? '')
    setServerIconInput(currentServer?.icon_url ?? '')
    setEditServerOpen(true)
  }

  const handleSaveServer = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const name = serverNameInput.trim()
    if (!name || savingServer || !currentServer) return
    setSavingServer(true)
    try {
      await updateServer(currentServer.id, name, serverIconInput.trim())
      setEditServerOpen(false)
      showToast.success('Servidor atualizado!')
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Falha ao salvar servidor.')
    } finally {
      setSavingServer(false)
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

  const initial = (user?.display_name ?? user?.username ?? '?').charAt(0).toUpperCase()
  const serverName = currentServer?.name ?? 'Servidor'

  /** Botão direito no canal abre o mesmo menu do "•••" (moderadores). */
  const channelContextMenu = (ch: Channel): ((e: React.MouseEvent) => void) | undefined =>
    isAdmin
      ? (e) => {
          e.preventDefault()
          setChannelMenuFor(ch.id)
        }
      : undefined

  const channelMenuButton = (ch: Channel): React.JSX.Element => (
    <button
      onClick={() => setChannelMenuFor(channelMenuFor === ch.id ? null : ch.id)}
      aria-label="Opções do canal"
      title="Opções do canal"
      className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 rounded-md p-0.5 text-gray-500 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
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
      showToast.error(err instanceof Error ? err.message : 'Não foi possível mudar o canal principal.')
    }
  }

  const channelMenu = (ch: Channel): React.JSX.Element => (
    <>
      <div className="fixed inset-0 z-20" onClick={() => setChannelMenuFor(null)} />
      <div className="absolute right-1.5 top-9 z-30 flex w-48 flex-col rounded-xl border border-white/10 bg-[#0d0e15]/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in">
        {(ch.type ?? 'text') === 'text' && ch.id !== primaryId && (
          <button
            onClick={() => void makePrimary(ch)}
            className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-gray-200 hover:bg-white/10 cursor-pointer"
          >
            <span>Definir como principal</span>
            <StarIcon className="h-3.5 w-3.5 text-amber-400" />
          </button>
        )}
        <button
          onClick={() => {
            setChannelMenuFor(null)
            setChannelName(ch.name)
            setEditingChannel(ch)
            openCreateChannelModal()
          }}
          className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-gray-200 hover:bg-white/10 cursor-pointer"
        >
          <span>Editar canal</span>
          <PencilIcon className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => {
            setChannelMenuFor(null)
            setDeletingChannel(ch)
          }}
          className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/15 cursor-pointer"
        >
          <span>Deletar canal</span>
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </>
  )

  return (
    <>
      <aside className="flex h-full w-60 shrink-0 flex-col border-r border-white/6 bg-[#0b0c10]/80 backdrop-blur-2xl">
        {/* Top Server Header with Dropdown */}
        <div className="relative flex h-14 shrink-0 items-center justify-between px-4 border-b border-white/6 shadow-xs">
          <button
            onClick={() => setDropdownOpen((d) => !d)}
            className="flex w-full items-center justify-between text-left font-bold text-white text-base truncate hover:text-gray-200 cursor-pointer"
          >
            <span className="truncate">{serverName}</span>
            <span className="text-xs text-gray-400 ml-1">▼</span>
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute top-14 left-3 right-3 z-30 flex flex-col rounded-xl border border-white/10 bg-[#0d0e15]/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2">
              {/* Qualquer membro pode convidar */}
              <button
                onClick={() => {
                  setDropdownOpen(false)
                  openInviteModal()
                }}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-600/20 hover:text-violet-200 cursor-pointer"
              >
                <span>Convidar pessoas</span>
                <UserPlusIcon className="h-4 w-4" />
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    openEditServer()
                  }}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-gray-200 hover:bg-white/10 cursor-pointer"
                >
                  <span>Editar servidor</span>
                  <PencilIcon className="h-3.5 w-3.5" />
                </button>
              )}
              {isOwner && (
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    setDeleteServerOpen(true)
                  }}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/15 cursor-pointer"
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
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Canais de texto
              </p>
              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingChannel(null)
                    setChannelName('')
                    setChannelType('text')
                    openCreateChannelModal()
                  }}
                  title="Criar canal de texto"
                  aria-label="Criar canal de texto"
                  className="cursor-pointer rounded-md p-0.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-1 flex flex-col gap-0.5">
              {textChannels.length === 0 && (
                <p className="px-2 text-xs text-gray-500 italic">Nenhum canal ainda.</p>
              )}
              {textChannels.map((ch) => {
                const active = ch.id === channelId
                const unread = unreadByRoom[`channel:${ch.id}`] ?? 0
                return (
                  <div key={ch.id} className="relative">
                    <button
                      onClick={() => navigate(`/servers/${currentServer?.id}/channels/${ch.id}`)}
                      onContextMenu={channelContextMenu(ch)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all cursor-pointer ${
                        active
                          ? 'bg-white/10 text-white shadow-sm'
                          : 'text-gray-400 hover:bg-white/6 hover:text-gray-200'
                      }`}
                    >
                      <span className="text-base leading-none text-gray-500">#</span>
                      <span className="truncate">{ch.name}</span>
                      {ch.id === primaryId && (
                        <span
                          title="Canal principal: avisos do servidor são enviados aqui"
                          className="shrink-0 text-amber-400/90"
                        >
                          <StarIcon className="h-3 w-3" />
                          <span className="sr-only">(canal principal)</span>
                        </span>
                      )}
                      {unread > 0 && (
                        <span className="ml-auto shrink-0 rounded-full bg-red-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </button>
                    {isAdmin && channelMenuButton(ch)}
                    {channelMenuFor === ch.id && channelMenu(ch)}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Canais de voz */}
          <div>
            <div className="flex items-center justify-between px-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Canais de voz
              </p>
              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingChannel(null)
                    setChannelName('')
                    setChannelType('voice')
                    openCreateChannelModal()
                  }}
                  title="Criar canal de voz"
                  aria-label="Criar canal de voz"
                  className="cursor-pointer rounded-md p-0.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-1 flex flex-col gap-0.5">
              {voiceChannels.length === 0 && (
                <p className="px-2 text-xs text-gray-500 italic">Nenhum canal de voz ainda.</p>
              )}
              {voiceChannels.map((ch) => {
                const callState = serverCalls[ch.id]
                const participants = callState?.participants ?? []
                const connectedHere =
                  callStatus !== 'idle' &&
                  activeCallType === 'channel' &&
                  activeCallChannelId === ch.id
                const live = liveUserIds(callState, connectedHere ? screenSharers : [])
                return (
                  <div
                    key={ch.id}
                    className="relative"
                    onDragOver={(e) => {
                      if (!isAdmin || !e.dataTransfer.types.includes(VOICE_USER_DRAG)) return
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
                      const userId = e.dataTransfer.getData(VOICE_USER_DRAG)
                      setVoiceDropTarget(null)
                      if (!userId || participants.some((p) => p.user_id === userId)) return
                      e.preventDefault()
                      void moveUser(userId, ch.id)
                    }}
                  >
                    <button
                      onClick={() => handleVoiceClick(ch)}
                      onContextMenu={channelContextMenu(ch)}
                      title={connectedHere ? 'Desconectar' : 'Conectar ao canal de voz'}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all cursor-pointer ${
                        voiceDropTarget === ch.id
                          ? 'bg-[#5865f2]/25 text-white ring-2 ring-[#5865f2]'
                          : connectedHere
                            ? 'text-white hover:bg-white/6'
                            : 'text-gray-400 hover:bg-white/6 hover:text-gray-200'
                      }`}
                    >
                      {/* Verde só nos canais com gente (pode ser em vários ao mesmo tempo). */}
                      <VolumeIcon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          participants.length > 0 ? 'text-[#23a55a]' : 'text-gray-500'
                        }`}
                      />
                      <span className="truncate">{ch.name}</span>
                      {participants.length > 0 && callState?.call?.started_at && (
                        <VoiceChannelTimer startedAt={callState.call.started_at} />
                      )}
                      {participants.length > 0 && (
                        <span className="ml-auto shrink-0 rounded-full bg-white/10 px-1.5 py-0.2 text-[10px] font-bold text-gray-300">
                          {participants.length}
                        </span>
                      )}
                    </button>
                    {participants.length > 0 && (
                      <div className="mb-1 ml-4 flex flex-col gap-0.5">
                        {participants.map((p) => {
                          const name = p.display_name ?? p.username ?? 'Usuário'
                          const isMe = p.user_id === user?.id
                          // Só sabemos quem fala no canal em que estamos conectados.
                          const talking = connectedHere && speakingIds.includes(p.user_id)
                          return (
                            <div
                              key={p.user_id}
                              onContextMenu={userMenuHandler(p.user_id, name, user?.id, p.username)}
                              onClick={profileCardHandler(p.user_id, name, p.username, 'right')}
                              draggable={canMove(p.user_id)}
                              onDragStart={(e) => {
                                e.dataTransfer.setData(VOICE_USER_DRAG, p.user_id)
                                e.dataTransfer.effectAllowed = 'move'
                              }}
                              onDragEnd={() => setVoiceDropTarget(null)}
                              title={canMove(p.user_id) ? 'Arraste para outro canal de voz' : undefined}
                              className={`group/voiceuser relative flex items-center gap-2 overflow-hidden rounded-md px-2 py-1 transition-colors ${
                                isMe ? 'bg-white/5 hover:bg-white/10' : 'hover:bg-white/[0.06]'
                              } ${canMove(p.user_id) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                            >
                              <div
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[9px] font-bold text-white transition-shadow ${
                                  talking ? 'ring-2 ring-[#23a55a]' : ''
                                }`}
                              >
                                {name.charAt(0).toUpperCase()}
                              </div>
                              <span className="truncate text-xs font-medium text-gray-300 transition-colors group-hover/voiceuser:text-white">
                                {name}
                                {isMe ? ' (você)' : ''}
                              </span>
                              <span className="ml-auto flex items-center gap-0.5 pr-1">
                                {live.has(p.user_id) && <LiveBadge />}
                                {!isMe && locallyMuted[p.user_id]?.muted && (
                                  <span title="Silenciado por você" className="text-gray-400">
                                    <VolumeOffIcon className="h-3.5 w-3.5" />
                                  </span>
                                )}
                                <VoiceStateIcons
                                  muted={isMe && connectedHere ? selfMuted : p.muted}
                                  deafened={isMe && connectedHere ? selfDeafened : p.deafened}
                                />
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {isAdmin && channelMenuButton(ch)}
                    {channelMenuFor === ch.id && channelMenu(ch)}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Painel de voz conectada (estilo Discord) */}
        <VoiceConnectedPanel />

        {/* User Control Card at Bottom Left */}
        <div className="flex shrink-0 items-center justify-between border-t border-white/6 bg-[#07080b]/90 px-2 py-2">
          <div
            className="flex min-w-0 items-center gap-2 rounded-md p-1 hover:bg-white/5 transition-colors cursor-pointer"
            onClick={() => setSettingsOpen(true)}
          >
            <div className="relative shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white shadow-md">
                {initial}
              </div>
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-white">{user?.display_name}</p>
              <p className="truncate text-[11px] text-gray-400">@{user?.username}</p>
            </div>
          </div>

          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Configurações do usuário"
            title="Configurações do usuário"
            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <GearIcon className="h-4 w-4" />
          </button>
        </div>
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
              className="mb-1 block text-xs font-semibold text-gray-400"
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
              <p className="mb-1 block text-xs font-semibold text-gray-400">Tipo do canal</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChannelType('text')}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    channelType === 'text'
                      ? 'border-violet-500 bg-violet-600/20 text-white'
                      : 'border-white/10 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <span className="text-base leading-none">#</span>
                  Texto
                </button>
                <button
                  type="button"
                  onClick={() => setChannelType('voice')}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    channelType === 'voice'
                      ? 'border-[#23a55a] bg-[#23a55a]/15 text-white'
                      : 'border-white/10 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <VolumeIcon className="h-4 w-4" />
                  Voz
                </button>
              </div>
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
        <p className="text-sm text-gray-300">
          Tem certeza que deseja deletar o canal{' '}
          <b className="text-white">#{deletingChannel?.name}</b>? Esta ação não pode ser desfeita e
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

      {/* Edit Server Modal */}
      <Modal open={editServerOpen} title="Editar servidor" onClose={() => setEditServerOpen(false)}>
        <form onSubmit={handleSaveServer} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-400" htmlFor="server-name">
              Nome do servidor
            </label>
            <Input
              id="server-name"
              placeholder="ex.: Meu Servidor"
              value={serverNameInput}
              onChange={(e) => setServerNameInput(e.target.value)}
              autoFocus
              maxLength={32}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-400" htmlFor="server-icon">
              URL do ícone (opcional)
            </label>
            <Input
              id="server-icon"
              placeholder="https://..."
              value={serverIconInput}
              onChange={(e) => setServerIconInput(e.target.value)}
              maxLength={500}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditServerOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={savingServer || !serverNameInput.trim()}
            >
              {savingServer ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Server Confirm Modal */}
      <Modal
        open={deleteServerOpen}
        title="Deletar servidor"
        onClose={() => setDeleteServerOpen(false)}
      >
        <p className="text-sm text-gray-300">
          Tem certeza que deseja deletar o servidor <b className="text-white">{serverName}</b>?
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

      {/* User Settings Modal */}
      <Modal
        open={settingsOpen}
        title="Configurações de Usuário"
        onClose={() => setSettingsOpen(false)}
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-lg font-bold text-white">
                {initial}
              </div>
              <div>
                <p className="font-semibold text-white text-base">{user?.display_name}</p>
                <p className="text-sm text-gray-400">@{user?.username}</p>
              </div>
            </div>
          </div>
          {settingsOpen && <VoiceSettings />}
          {settingsOpen && <AppSettings />}
          <Button variant="danger" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? 'Saindo...' : 'Sair da conta'}
          </Button>
        </div>
      </Modal>
    </>
  )
}

export default ServerSidebar
