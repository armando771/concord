import { useEffect, useState } from 'react'
import { serverIconSrc } from '../lib/serverIcon'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  PlusIcon,
  InboxIcon,
  DiamondIcon,
  ChangelogIcon,
  SalinhaMarkIcon,
  VolumeIcon
} from './icons'
import { useServerStore } from '../store/serverStore'
import { useInviteStore } from '../store/inviteStore'
import { useAuthStore } from '../store/authStore'
import { useProposalStore } from '../store/proposalStore'
import { useNotifySettingsStore } from '../store/notifySettingsStore'
import { isMutedNow } from '../lib/notificationMute'
import { useNow } from './useNow'
import { badgeCount } from '../lib/proposals'
import { useChatStore } from '../store/chatStore'
import { useServersVoiceActivity } from './useServersVoiceActivity'
import { useCallStore } from '../store/callStore'
import { voiceServerId } from '../lib/voiceServer'
import { useFriendStore } from '../store/friendStore'
import { showToast } from '../store/toastStore'
import Modal from './Modal'
import Button from './Button'
import Input from './Input'
import ServerIconPicker from './serverSettings/ServerIconPicker'
import type { MediaChange } from '../lib/profileValidation'
import { joinServerByCode } from '../api/servers'
import { parseInviteInput } from '../lib/inviteLink'
import { ServerRailSkeleton } from './skeleton/layouts'

function ServerRail(): React.JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()

  const servers = useServerStore((s) => s.servers)
  const serversLoaded = useServerStore((s) => s.serversLoaded)
  const fetchServers = useServerStore((s) => s.fetchServers)
  const addServer = useServerStore((s) => s.addServer)
  const setServerIcon = useServerStore((s) => s.setServerIcon)
  const clearCurrentServer = useServerStore((s) => s.clearCurrentServer)

  const invites = useInviteStore((s) => s.invites)
  const fetchInvites = useInviteStore((s) => s.fetchInvites)

  const proposals = useProposalStore((s) => s.proposals)
  const fetchProposals = useProposalStore((s) => s.fetchProposals)
  const proposalMentions = useProposalStore((s) => s.pendingMentions)
  const proposalsSeenAt = useProposalStore((s) => s.lastSeenAt)
  const fetchProposalMentions = useProposalStore((s) => s.fetchMentions)
  const meId = useAuthStore((s) => s.user?.id ?? null)
  const onProposals = location.pathname === '/proposals'
  const onChangelog = location.pathname === '/changelog'
  // Propostas novas e menções desde a última visita; com o quadro aberto não mostra nada.
  const proposalsBadge = onProposals
    ? 0
    : badgeCount(proposals, proposalMentions, proposalsSeenAt, meId)

  const voiceSrvId = useCallStore((s) => voiceServerId(s))
  const voiceActiveServers = useServersVoiceActivity(servers.map((srv) => srv.id))
  const unreadByRoom = useChatStore((s) => s.unreadByRoom)
  const unreadByServer = useChatStore((s) => s.unreadByServer)
  const mentionsByServer = useChatStore((s) => s.mentionsByServer)
  const notifyServers = useNotifySettingsStore((s) => s.servers)
  const openNotifyModal = useNotifySettingsStore((s) => s.openModal)
  const now = useNow()
  const conversations = useChatStore((s) => s.conversations)
  const incomingRequests = useFriendStore(
    (s) => s.pending.filter((p) => p.direction === 'incoming').length
  )
  const fetchChannelsForServers = useChatStore((s) => s.fetchChannelsForServers)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [serverName, setServerName] = useState('')
  const [icon, setIcon] = useState<MediaChange>({ kind: 'keep' })
  const [creating, setCreating] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    fetchServers()
  }, [fetchServers])

  useEffect(() => {
    fetchInvites()
  }, [fetchInvites])

  useEffect(() => {
    fetchProposals()
  }, [fetchProposals])

  useEffect(() => {
    void fetchProposalMentions()
  }, [fetchProposalMentions])

  useEffect(() => {
    if (servers.length > 0) {
      fetchChannelsForServers(servers.map((s) => s.id))
    }
  }, [servers, fetchChannelsForServers])

  useEffect(() => {
    const ids = servers.map((s) => s.id)
    const chat = useChatStore.getState()
    ids.forEach((id) => chat.openServer(id))
    return () => {
      ids.forEach((id) => chat.closeServer(id))
    }
  }, [servers])

  const unreadByServerId = (serverId: string): number => unreadByServer[serverId] ?? 0

  // Selo da home: DMs não lidas + pedidos de amizade recebidos.
  const dmUnread =
    conversations.reduce((sum, conv) => sum + (unreadByRoom[`conversation:${conv.id}`] ?? 0), 0) +
    incomingRequests

  const isHome =
    location.pathname === '/' ||
    location.pathname === '/friends' ||
    location.pathname.startsWith('/dm/')

  const handleCreateServer = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!serverName.trim()) return

    setCreating(true)
    try {
      const newServer = await addServer(serverName.trim())
      if (icon.kind === 'set') {
        try {
          await setServerIcon(newServer.id, { file: icon.file, staticFrame: icon.staticFrame })
        } catch (err) {
          // O servidor já existe: o ícone pode ser tentado de novo nas configurações.
          showToast.error(
            err instanceof Error ? err.message : 'Servidor criado, mas o ícone não foi enviado.'
          )
        }
      }
      showToast.success(`Servidor "${newServer.name}" criado com sucesso!`)
      setServerName('')
      setIcon({ kind: 'keep' })
      setCreateModalOpen(false)
      navigate(`/servers/${newServer.id}`)
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Falha ao criar servidor.')
    } finally {
      setCreating(false)
    }
  }

  const handleJoinByCode = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!joinCode.trim()) return
    // Aceita o código ou o link de convite colado inteiro.
    const code = parseInviteInput(joinCode)
    if (!code) {
      showToast.error('Link ou código de convite inválido.')
      return
    }

    setJoining(true)
    try {
      const server = await joinServerByCode(code)
      await fetchServers()
      showToast.success(`Você entrou em "${server.name}"!`)
      setJoinCode('')
      setCreateModalOpen(false)
      navigate(`/servers/${server.id}`)
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Código de convite inválido.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <>
      <aside className="group/rail flex h-full w-18 shrink-0 flex-col items-center gap-2 border-r border-subtle bg-tertiary py-3 backdrop-blur-2xl">
        {/* Início: botão com a marca da Salinha */}
        <div className="relative flex items-center justify-center">
          <span
            className={`absolute -left-3.5 w-2 rounded-r-full bg-[var(--text-strong)] transition-all duration-200 ${
              isHome ? 'h-10' : 'h-0 group-hover/home:h-5'
            }`}
          />
          <Link
            to="/friends"
            onClick={clearCurrentServer}
            aria-label="Início"
            title="Mensagens Diretas e Amigos"
            className={`group/home relative flex h-12 w-12 items-center justify-center font-bold text-xl shadow-lg transition-all duration-200 ${
              isHome
                ? 'rounded-2xl bg-linear-to-br from-violet-600 to-indigo-600 text-white shadow-violet-500/30'
                : 'rounded-3xl bg-surface border border-subtle text-strong hover:text-white hover:rounded-2xl hover:bg-linear-to-br hover:from-violet-600 hover:to-indigo-600 hover:shadow-violet-500/30'
            }`}
          >
            <SalinhaMarkIcon className="h-8 w-8" />
          </Link>
          {dmUnread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-md">
              {dmUnread > 99 ? '99+' : dmUnread}
            </span>
          )}
        </div>

        <div className="my-1 h-0.5 w-8 rounded-full bg-fg/10" />

        {/* Invites Button with Pending Badge */}
        <div className="relative flex items-center justify-center">
          <button
            onClick={() => {
              clearCurrentServer()
              navigate('/invites')
            }}
            title="Convites de servidor"
            aria-label="Convites de servidor"
            className={`relative flex h-12 w-12 cursor-pointer items-center justify-center transition-all duration-200 ${
              location.pathname === '/invites'
                ? 'rounded-2xl bg-violet-600 shadow-md shadow-violet-500/30'
                : 'rounded-3xl border border-subtle bg-surface hover:rounded-2xl hover:bg-violet-600 hover:shadow-md hover:shadow-violet-500/30'
            }`}
          >
            <InboxIcon
              className={`h-6 w-6 ${
                location.pathname === '/invites' ? 'text-white' : 'text-violet-400'
              }`}
            />
          </button>
          {invites.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-md">
              {invites.length}
            </span>
          )}
        </div>

        {/* Quadro de propostas (kanban com votação) */}
        <div className="relative flex items-center justify-center">
          <button
            onClick={() => {
              clearCurrentServer()
              navigate('/proposals')
            }}
            title="Propostas de melhoria"
            aria-label="Propostas de melhoria"
            className={`relative flex h-12 w-12 cursor-pointer items-center justify-center transition-all duration-200 ${
              onProposals
                ? 'rounded-2xl bg-violet-600 shadow-md shadow-violet-500/30'
                : 'rounded-3xl border border-subtle bg-surface hover:rounded-2xl hover:bg-violet-600 hover:shadow-md hover:shadow-violet-500/30'
            }`}
          >
            <DiamondIcon className={`h-6 w-6 ${onProposals ? 'text-white' : 'text-violet-400'}`} />
          </button>
          {proposalsBadge > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-md">
              {proposalsBadge > 99 ? '99+' : proposalsBadge}
            </span>
          )}
        </div>

        {/* Novidades: changelog por versão */}
        <div className="relative flex items-center justify-center">
          <button
            onClick={() => {
              clearCurrentServer()
              navigate('/changelog')
            }}
            title="Novidades"
            aria-label="Novidades"
            className={`relative flex h-12 w-12 cursor-pointer items-center justify-center transition-all duration-200 ${
              onChangelog
                ? 'rounded-2xl bg-violet-600 shadow-md shadow-violet-500/30'
                : 'rounded-3xl border border-subtle bg-surface hover:rounded-2xl hover:bg-violet-600 hover:shadow-md hover:shadow-violet-500/30'
            }`}
          >
            <ChangelogIcon
              className={`h-6 w-6 ${onChangelog ? 'text-white' : 'text-violet-400'}`}
            />
          </button>
        </div>

        {/* Real User Servers List */}
        {/* O padding dá espaço aos selos (voz, não lidas), que ficam metade para fora do
            ícone: sem ele o overflow da lista corta os selos. */}
        <div className="-my-1 flex flex-col gap-2 overflow-y-auto no-scrollbar px-2 py-2">
          {/* Só na primeira carga: depois a lista é trocada por baixo, sem piscar. */}
          {!serversLoaded && servers.length === 0 && <ServerRailSkeleton />}
          {servers.map((srv) => {
            const isActive = location.pathname === `/servers/${srv.id}`
            const initialChar = srv.name.charAt(0).toUpperCase()
            const muted = isMutedNow(notifyServers[srv.id], now)
            const mentions = mentionsByServer[srv.id] ?? 0
            const unread = muted ? 0 : unreadByServerId(srv.id)
            return (
              <div key={srv.id} className="relative flex items-center justify-center group/srv">
                <span
                  className={`absolute -left-3.5 w-2 rounded-r-full bg-[var(--text-strong)] transition-all duration-200 ${
                    isActive ? 'h-10' : 'h-0 group-hover/srv:h-5'
                  }`}
                />
                <button
                  onClick={() => navigate(`/servers/${srv.id}`)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    openNotifyModal({ serverId: srv.id, name: srv.name })
                  }}
                  title={srv.name}
                  className={`group/btn relative flex h-12 w-12 items-center justify-center font-bold text-base transition-all duration-200 cursor-pointer overflow-hidden ${
                    muted && !isActive && mentions === 0 ? 'opacity-50' : ''
                  } ${
                    isActive
                      ? 'rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-500/30'
                      : 'rounded-3xl bg-surface border border-subtle text-strong hover:text-white hover:rounded-2xl hover:bg-violet-600 hover:shadow-md hover:shadow-violet-500/30'
                  }`}
                >
                  {srv.icon_url ? (
                    <img
                      src={serverIconSrc(srv.icon_url)}
                      alt={srv.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{initialChar}</span>
                  )}
                </button>
                {(mentions > 0 || unread > 0) && (
                  <span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-md">
                    {(() => {
                      const n = mentions > 0 ? mentions : unread
                      return n > 99 ? '99+' : n
                    })()}
                  </span>
                )}
                {(srv.id === voiceSrvId || voiceActiveServers.has(srv.id)) && (
                  <span
                    title={srv.id === voiceSrvId ? 'Em chamada' : 'Chamada em andamento'}
                    aria-label={srv.id === voiceSrvId ? 'Em chamada' : 'Chamada em andamento'}
                    className={`absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-[3px] border-[var(--bg-app)] shadow-md ${
                      srv.id === voiceSrvId
                        ? 'bg-discord-green text-white'
                        : 'bg-accent text-discord-green'
                    }`}
                  >
                    <VolumeIcon className="h-3 w-3" />
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Add Server Button */}
        <div className="group/btn relative flex items-center justify-center">
          <button
            onClick={() => setCreateModalOpen(true)}
            title="Adicionar um servidor"
            aria-label="Adicionar servidor"
            className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-3xl border border-subtle bg-surface text-discord-green transition-all duration-200 hover:rounded-2xl hover:bg-discord-green hover:text-white hover:shadow-lg hover:shadow-discord-green/25"
          >
            <PlusIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Explore / Discover Button */}
        <div className="flex-1" />
      </aside>

      {/* Modal Criar Servidor */}
      <Modal
        open={createModalOpen}
        title="Criar ou entrar em um servidor"
        onClose={() => setCreateModalOpen(false)}
      >
        <form onSubmit={handleCreateServer} className="flex flex-col gap-4">
          <p className="text-xs text-gray-400">
            Dê um nome e uma personalidade ao seu novo servidor. Você poderá alterar isso a qualquer
            momento.
          </p>

          <Input
            label="Nome do servidor"
            placeholder="Ex: Servidor dos Brothers"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            autoFocus
          />

          <ServerIconPicker name={serverName} value={icon} onChange={setIcon} />

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={creating || !serverName.trim()}>
              {creating ? 'Criando...' : 'Criar servidor'}
            </Button>
          </div>
        </form>

        {/* Entrar em um servidor existente com o código de convite */}
        <form
          onSubmit={handleJoinByCode}
          className="mt-5 flex flex-col gap-3 border-t border-subtle pt-5"
        >
          <p className="text-sm font-semibold text-strong">Entrar com código</p>
          <p className="-mt-1 text-xs text-gray-400">Cole o link de convite ou digite o código.</p>
          <div className="flex gap-2">
            <Input
              placeholder="Ex: K7P2QX9M ou https://app-salinha.bhrx.com.br/convite/K7P2QX9M"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              aria-label="Código ou link de convite"
              className="font-mono"
            />
            <Button type="submit" variant="success" disabled={joining || !joinCode.trim()}>
              {joining ? 'Entrando...' : 'Entrar'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

export default ServerRail
