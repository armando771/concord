import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PlusIcon, InboxIcon, SalinhaMarkIcon } from './icons'
import { useServerStore } from '../store/serverStore'
import { useInviteStore } from '../store/inviteStore'
import { useChatStore } from '../store/chatStore'
import { useFriendStore } from '../store/friendStore'
import { showToast } from '../store/toastStore'
import Modal from './Modal'
import Button from './Button'
import Input from './Input'
import { joinServerByCode } from '../api/servers'
import { parseInviteInput } from '../lib/inviteLink'

function ServerRail(): React.JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()

  const servers = useServerStore((s) => s.servers)
  const fetchServers = useServerStore((s) => s.fetchServers)
  const addServer = useServerStore((s) => s.addServer)
  const clearCurrentServer = useServerStore((s) => s.clearCurrentServer)

  const invites = useInviteStore((s) => s.invites)
  const fetchInvites = useInviteStore((s) => s.fetchInvites)

  const unreadByRoom = useChatStore((s) => s.unreadByRoom)
  const unreadByServer = useChatStore((s) => s.unreadByServer)
  const conversations = useChatStore((s) => s.conversations)
  const incomingRequests = useFriendStore(
    (s) => s.pending.filter((p) => p.direction === 'incoming').length
  )
  const fetchChannelsForServers = useChatStore((s) => s.fetchChannelsForServers)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [serverName, setServerName] = useState('')
  const [iconUrl, setIconUrl] = useState('')
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
      const newServer = await addServer(serverName.trim(), iconUrl.trim() || undefined)
      showToast.success(`Servidor "${newServer.name}" criado com sucesso!`)
      setServerName('')
      setIconUrl('')
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
      <aside className="group/rail flex h-full w-18 shrink-0 flex-col items-center gap-2 border-r border-white/6 bg-[#06070a]/85 py-3 backdrop-blur-2xl">
        {/* Início: botão com a marca da Salinha */}
        <div className="relative flex items-center justify-center">
          <span
            className={`absolute -left-3.5 w-2 rounded-r-full bg-white transition-all duration-200 ${
              isHome ? 'h-10' : 'h-0 group-hover/home:h-5'
            }`}
          />
          <Link
            to="/friends"
            onClick={clearCurrentServer}
            aria-label="Início"
            title="Mensagens Diretas e Amigos"
            className={`group/home relative flex h-12 w-12 items-center justify-center font-bold text-xl text-white shadow-lg transition-all duration-200 ${
              isHome
                ? 'rounded-2xl bg-linear-to-br from-violet-600 to-indigo-600 shadow-violet-500/30'
                : 'rounded-3xl bg-[#12141d]/80 border border-white/10 hover:rounded-2xl hover:bg-linear-to-br hover:from-violet-600 hover:to-indigo-600 hover:shadow-violet-500/30'
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

        <div className="my-1 h-0.5 w-8 rounded-full bg-white/10" />

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
                : 'rounded-3xl border border-white/6 bg-[#12141d]/80 hover:rounded-2xl hover:bg-violet-600 hover:shadow-md hover:shadow-violet-500/30'
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

        {/* Real User Servers List */}
        <div className="flex flex-col gap-2 overflow-y-auto no-scrollbar py-1">
          {servers.map((srv) => {
            const isActive = location.pathname === `/servers/${srv.id}`
            const initialChar = srv.name.charAt(0).toUpperCase()
            const unread = unreadByServerId(srv.id)
            return (
              <div key={srv.id} className="relative flex items-center justify-center group/srv">
                <span
                  className={`absolute -left-3.5 w-2 rounded-r-full bg-white transition-all duration-200 ${
                    isActive ? 'h-10' : 'h-0 group-hover/srv:h-5'
                  }`}
                />
                <button
                  onClick={() => navigate(`/servers/${srv.id}`)}
                  title={srv.name}
                  className={`group/btn relative flex h-12 w-12 items-center justify-center font-bold text-base text-white transition-all duration-200 cursor-pointer overflow-hidden ${
                    isActive
                      ? 'rounded-2xl bg-violet-600 shadow-md shadow-violet-500/30'
                      : 'rounded-3xl bg-[#12141d]/80 border border-white/10 hover:rounded-2xl hover:bg-violet-600 hover:shadow-md hover:shadow-violet-500/30'
                  }`}
                >
                  {srv.icon_url ? (
                    <img src={srv.icon_url} alt={srv.name} className="h-full w-full object-cover" />
                  ) : (
                    <span>{initialChar}</span>
                  )}
                </button>
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-md">
                    {unread > 99 ? '99+' : unread}
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
            className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-3xl border border-white/6 bg-[#12141d]/60 text-discord-green transition-all duration-200 hover:rounded-2xl hover:bg-discord-green hover:text-white hover:shadow-lg hover:shadow-discord-green/25"
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
            label="NOME DO SERVIDOR"
            placeholder="Ex: Servidor dos Brothers"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            autoFocus
          />

          <Input
            label="URL DO ÍCONE (OPCIONAL)"
            placeholder="https://exemplo.com/icone.png"
            value={iconUrl}
            onChange={(e) => setIconUrl(e.target.value)}
          />

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
          className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5"
        >
          <p className="text-sm font-semibold text-white">Entrar com código</p>
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
