import { useEffect, useState } from 'react'
import InviteCodeBox from '../components/InviteCodeBox'
import { Navigate, useParams } from 'react-router-dom'
import { useServerStore } from '../store/serverStore'
import { useFriendStore } from '../store/friendStore'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { useChatStore } from '../store/chatStore'
import { showToast } from '../store/toastStore'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import ChatPane from '../components/ChatPane'
import VoiceChannelView from '../components/call/VoiceChannelView'
import { UserPlusIcon, SearchIcon, VolumeIcon } from '../components/icons'

interface MemberRowProps {
  userId: string
  displayName: string
  handle: string
  colorClass: string
  nameClass: string
  online: boolean
}

function MemberRow({
  userId,
  displayName,
  handle,
  colorClass,
  nameClass,
  online
}: MemberRowProps): React.JSX.Element {
  const initial = displayName.charAt(0).toUpperCase()
  return (
    <div key={userId} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5">
      <div className="relative shrink-0">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full font-bold text-xs text-white ${colorClass}`}
        >
          {initial}
        </div>
        <span
          className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-[#07080b] ${
            online ? 'bg-[#23a55a]' : 'bg-gray-600'
          }`}
          title={online ? 'Online' : 'Offline'}
        />
      </div>
      <div className="min-w-0 leading-tight">
        <p className={`truncate text-sm font-semibold ${nameClass}`}>{displayName}</p>
        <p className="truncate text-[11px] text-gray-400">@{handle}</p>
      </div>
    </div>
  )
}

export function ServerView(): React.JSX.Element {
  const { id, channelId } = useParams<{ id: string; channelId: string }>()
  const me = useAuthStore((s) => s.user)

  const currentServer = useServerStore((s) => s.currentServer)
  const currentMembers = useServerStore((s) => s.currentMembers)
  const channels = useServerStore((s) => s.channels)
  const serverInvites = useServerStore((s) => s.serverInvites)
  const loading = useServerStore((s) => s.loading)
  const selectServer = useServerStore((s) => s.selectServer)
  const fetchChannels = useServerStore((s) => s.fetchChannels)
  const inviteUser = useServerStore((s) => s.inviteUser)
  const fetchServerInvites = useServerStore((s) => s.fetchServerInvites)

  const isAdmin =
    currentServer?.owner_id === me?.id ||
    currentMembers.some((m) => m.user_id === me?.id && m.role === 'admin')

  const presence = useChatStore((s) => s.presence)
  const fetchPresenceFor = useChatStore((s) => s.fetchPresenceFor)

  const friends = useFriendStore((s) => s.friends)
  const loadFriends = useFriendStore((s) => s.loadAll)

  const inviteModalOpen = useUIStore((s) => s.serverInviteModalOpen)
  const openInviteModal = useUIStore((s) => s.openServerInviteModal)
  const closeInviteModal = useUIStore((s) => s.closeServerInviteModal)

  const [inviteFilter, setInviteFilter] = useState('')
  const [invitingId, setInvitingId] = useState<string | null>(null)

  useEffect(() => {
    return () => closeInviteModal()
  }, [closeInviteModal])

  useEffect(() => {
    if (id) {
      selectServer(id).catch((err) => {
        showToast.error(err instanceof Error ? err.message : 'Falha ao carregar servidor.')
      })
      fetchChannels(id)
    }
  }, [id, selectServer, fetchChannels])

  useEffect(() => {
    if (currentMembers.length > 0) {
      fetchPresenceFor(currentMembers.map((m) => m.user_id))
    }
  }, [currentMembers, fetchPresenceFor])

  useEffect(() => {
    if (inviteModalOpen && id) {
      fetchServerInvites(id)
    }
  }, [inviteModalOpen, id, fetchServerInvites])

  useEffect(() => {
    loadFriends()
  }, [loadFriends])

  const handleInvite = async (friendUserId: string, friendUsername: string): Promise<void> => {
    if (!id) return
    setInvitingId(friendUserId)
    try {
      await inviteUser(id, friendUserId)
      showToast.success(`Convite enviado para @${friendUsername}!`)
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Falha ao convidar amigo.')
    } finally {
      setInvitingId(null)
    }
  }

  if (loading || !currentServer) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#07080b]/90 text-gray-400">
        <p className="text-sm">Carregando servidor...</p>
      </div>
    )
  }

  const memberUserIds = new Set(currentMembers.map((m) => m.user_id))
  const pendingInviteUserIds = new Set(serverInvites.map((i) => i.invitee_id))

  const inviteTerm = inviteFilter.trim().toLowerCase()
  const filteredFriends = friends.filter((f) => {
    if (!inviteTerm) return true
    return (
      (f.display_name ?? '').toLowerCase().includes(inviteTerm) ||
      f.username.toLowerCase().includes(inviteTerm)
    )
  })

  // Separar membros por Papel (Dono, Admin, Membro)
  const ownerMembers = currentMembers.filter((m) => m.user_id === currentServer.owner_id)
  const adminMembers = currentMembers.filter(
    (m) => m.user_id !== currentServer.owner_id && m.role === 'admin'
  )
  const regularMembers = currentMembers.filter(
    (m) => m.user_id !== currentServer.owner_id && m.role !== 'admin'
  )
  const offlineMembers = currentMembers.filter((m) => !presence[m.user_id])

  const activeChannel = channels.find((c) => c.id === channelId)

  const firstTextChannelId = channels.find((c) => (c.type ?? 'text') === 'text')?.id

  if (!channelId && firstTextChannelId) {
    return <Navigate to={`/servers/${id}/channels/${firstTextChannelId}`} replace />
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#07080b]/90 backdrop-blur-2xl text-gray-100">
      {/* Central Server View Column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-white/6">
        {/* Top Channel Header Bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/6 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex items-center gap-2 text-gray-300 font-bold text-lg">
              {activeChannel?.type === 'voice' ? (
                <VolumeIcon className="h-5 w-5 text-gray-400" />
              ) : (
                <span className="text-gray-400 text-xl font-bold">#</span>
              )}
              <span className="truncate text-white text-base">
                {activeChannel?.name ?? currentServer.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                variant="secondary"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                onClick={openInviteModal}
              >
                <UserPlusIcon className="h-4 w-4" />
                <span>Convidar</span>
              </Button>
            )}
          </div>
        </header>

        {channelId && activeChannel?.type === 'voice' ? (
          <VoiceChannelView channelId={channelId} />
        ) : channelId ? (
          <ChatPane
            room={`channel:${channelId}`}
            placeholder={`Mensagem para #${activeChannel?.name ?? 'canal'}`}
          />
        ) : (
          <div className="flex flex-1 flex-col justify-between overflow-y-auto p-6">
            <div className="my-auto max-w-lg space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-600/30 border border-violet-500/40 text-violet-300 font-bold text-2xl shadow-lg">
                #
              </div>
              <h1 className="text-3xl font-bold text-white">Bem-vindo a #{currentServer.name}!</h1>
              <p className="text-sm text-gray-400 leading-relaxed">
                Este é o início do servidor{' '}
                <strong className="text-white">{currentServer.name}</strong>. Convide seus amigos e
                comece a conversar!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Server Members List */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col overflow-y-auto border-l border-white/6 bg-[#07080b]/60 p-4 space-y-6">
        {/* Owner Group */}
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Dono do Servidor — {ownerMembers.length}
          </p>
          <div className="flex flex-col gap-1">
            {ownerMembers.map((m) => {
              const displayName =
                m.display_name ?? m.username ?? (m.user_id === me?.id ? me?.display_name : 'Dono')
              const handle = m.username ?? (m.user_id === me?.id ? me?.username : 'dono')
              return (
                <MemberRow
                  key={m.user_id}
                  userId={m.user_id}
                  displayName={displayName}
                  handle={handle}
                  colorClass="bg-amber-600"
                  nameClass="text-amber-300"
                  online={Boolean(presence[m.user_id])}
                />
              )
            })}
          </div>
        </div>

        {/* Admin Group */}
        {adminMembers.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Administradores — {adminMembers.length}
            </p>
            <div className="flex flex-col gap-1">
              {adminMembers.map((m) => {
                const displayName = m.display_name ?? m.username ?? 'Admin'
                const handle = m.username ?? 'admin'
                return (
                  <MemberRow
                    key={m.user_id}
                    userId={m.user_id}
                    displayName={displayName}
                    handle={handle}
                    colorClass="bg-violet-600"
                    nameClass="text-violet-300"
                    online={Boolean(presence[m.user_id])}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Regular Members Group */}
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Membros — {regularMembers.length}
          </p>
          <div className="flex flex-col gap-1">
            {regularMembers.map((m) => {
              const displayName =
                m.display_name ?? m.username ?? (m.user_id === me?.id ? me?.display_name : 'Membro')
              const handle = m.username ?? (m.user_id === me?.id ? me?.username : 'membro')
              return (
                <MemberRow
                  key={m.user_id}
                  userId={m.user_id}
                  displayName={displayName}
                  handle={handle}
                  colorClass="bg-indigo-600"
                  nameClass="text-gray-200"
                  online={Boolean(presence[m.user_id])}
                />
              )
            })}
          </div>
        </div>

        {/* Offline Group */}
        {offlineMembers.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Offline — {offlineMembers.length}
            </p>
            <div className="flex flex-col gap-1 opacity-70">
              {offlineMembers.map((m) => {
                const displayName =
                  m.display_name ??
                  m.username ??
                  (m.user_id === me?.id ? me?.display_name : 'Membro')
                const handle = m.username ?? (m.user_id === me?.id ? me?.username : 'membro')
                return (
                  <MemberRow
                    key={m.user_id}
                    userId={m.user_id}
                    displayName={displayName}
                    handle={handle}
                    colorClass="bg-gray-600"
                    nameClass="text-gray-400"
                    online={false}
                  />
                )
              })}
            </div>
          </div>
        )}
      </aside>

      {/* Modal Convidar Amigos */}
      <Modal
        open={inviteModalOpen}
        title={`Convidar amigos para ${currentServer.name}`}
        onClose={closeInviteModal}
      >
        <div className="space-y-4">
          <InviteCodeBox serverId={currentServer.id} />
          <p className="text-xs text-gray-400">
            Ou selecione um amigo para enviar um convite. Ele poderá aceitar ou recusar.
          </p>

          <div className="relative">
            <Input
              placeholder="Buscar amigo por nome"
              value={inviteFilter}
              onChange={(e) => setInviteFilter(e.target.value)}
              className="glass-input pl-9 text-sm"
              autoFocus
            />
            <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>

          {friends.length === 0 ? (
            <p className="py-6 text-center text-xs text-gray-500 italic">
              Você ainda não tem amigos para convidar. Adicione amigos primeiro na aba
              &quot;Amigos&quot;.
            </p>
          ) : (
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto no-scrollbar pr-1">
              {filteredFriends.map((f) => {
                const alreadyInServer = memberUserIds.has(f.id)
                const alreadyInvited = pendingInviteUserIds.has(f.id)
                const isInviting = invitingId === f.id
                const initialChar = (f.display_name ?? f.username).charAt(0).toUpperCase()

                return (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded-xl border border-white/6 bg-white/3 p-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 font-bold text-xs text-white">
                        {initialChar}
                      </div>
                      <div className="leading-tight">
                        <p className="text-sm font-semibold text-white">{f.display_name}</p>
                        <p className="text-[11px] text-gray-400">@{f.username}</p>
                      </div>
                    </div>

                    {alreadyInServer ? (
                      <span className="text-xs text-gray-500">Já é membro</span>
                    ) : alreadyInvited ? (
                      <span className="text-xs text-violet-300">Convite pendente</span>
                    ) : (
                      <Button
                        variant="success"
                        className="px-3 py-1 text-xs"
                        disabled={isInviting}
                        onClick={() => handleInvite(f.id, f.username)}
                      >
                        {isInviting ? 'Convidando...' : 'Convidar'}
                      </Button>
                    )}
                  </div>
                )
              })}

              {filteredFriends.length === 0 && (
                <p className="py-6 text-center text-xs text-gray-500 italic">
                  Nenhum amigo encontrado para &quot;{inviteFilter}&quot;.
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default ServerView
