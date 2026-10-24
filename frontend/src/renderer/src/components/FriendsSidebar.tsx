import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useUIStore, type FriendsTab } from '../store/uiStore'
import { useFriendStore } from '../store/friendStore'
import { useInviteStore } from '../store/inviteStore'
import { useChatStore } from '../store/chatStore'
import { logout } from '../api/auth'
import Modal from './Modal'
import Button from './Button'
import VoiceConnectedPanel from './call/VoiceConnectedPanel'
import { FriendsIcon, ClockIcon, UserPlusIcon, GearIcon, ChatBubbleIcon } from './icons'
import VoiceSettings from './VoiceSettings'
import AppSettings from './AppSettings'

interface NavItem {
  id: FriendsTab
  label: string
  icon: (props: { className?: string }) => React.JSX.Element
}

const navItems: NavItem[] = [
  { id: 'all', label: 'Todos', icon: FriendsIcon },
  { id: 'pending', label: 'Pendentes', icon: ClockIcon },
  { id: 'add', label: 'Adicionar', icon: UserPlusIcon }
]

function formatLastMessageTime(iso?: string): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function FriendsSidebar(): React.JSX.Element {
  const navigate = useNavigate()
  const { userId } = useParams<{ userId: string }>()
  const user = useAuthStore((s) => s.user)
  const clear = useAuthStore((s) => s.clear)
  const pending = useFriendStore((s) => s.pending)
  const loadAll = useFriendStore((s) => s.loadAll)
  const friendsTab = useUIStore((s) => s.friendsTab)
  const setFriendsTab = useUIStore((s) => s.setFriendsTab)
  const conversations = useChatStore((s) => s.conversations)
  const conversationsLoading = useChatStore((s) => s.conversationsLoading)
  const presence = useChatStore((s) => s.presence)
  const unreadByRoom = useChatStore((s) => s.unreadByRoom)
  const fetchConversations = useChatStore((s) => s.fetchConversations)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    loadAll()
    fetchConversations()
  }, [loadAll, fetchConversations])

  const handleLogout = async (): Promise<void> => {
    setLoggingOut(true)
    try {
      await logout()
    } catch {
      // Limpa sessão local em caso de erro
    } finally {
      useFriendStore.getState().reset()
      useInviteStore.getState().reset()
      useChatStore.getState().disconnect()
      clear()
      setSettingsOpen(false)
      navigate('/login')
    }
  }

  const initial = (user?.display_name ?? user?.username ?? '?').charAt(0).toUpperCase()

  return (
    <>
      <aside className="flex h-full w-60 shrink-0 flex-col border-r border-white/6 bg-[#0b0c10]/80 backdrop-blur-2xl">
        {/* Scrollable Navigation Area */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {/* Main Navigation Links */}
          <nav className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const active = friendsTab === item.id
              const Icon = item.icon
              const isPending = item.id === 'pending'
              const pendingCount = pending.length
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setFriendsTab(item.id)
                    navigate('/friends')
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    active
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-gray-400 hover:bg-white/6 hover:text-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-gray-400'}`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {isPending && pendingCount > 0 && (
                    <span className="rounded-full bg-red-500 px-1.5 py-0.2 text-[11px] font-bold text-white">
                      {pendingCount}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Mensagens Section */}
          <div>
            <div className="flex items-center justify-between px-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Mensagens
              </p>
              <ChatBubbleIcon className="h-3.5 w-3.5 text-gray-500" />
            </div>
            <div className="mt-1 flex flex-col gap-0.5">
              {conversationsLoading && conversations.length === 0 && (
                <p className="px-2 py-1 text-xs text-gray-500 italic">Carregando...</p>
              )}
              {!conversationsLoading && conversations.length === 0 && (
                <p className="px-2 py-1 text-xs text-gray-500 italic">Nenhuma conversa ainda.</p>
              )}
              {conversations.map((conv) => {
                const active = conv.other_user.id === userId
                const online = Boolean(presence[conv.other_user.id])
                const unread = unreadByRoom[`conversation:${conv.id}`] ?? 0
                const lastPreview = conv.last_message?.content ?? 'Inicie uma conversa!'
                const lastTime = formatLastMessageTime(conv.last_message?.created_at)
                const otherInitial = (
                  conv.other_user.display_name ??
                  conv.other_user.username ??
                  '?'
                )
                  .charAt(0)
                  .toUpperCase()
                return (
                  <button
                    key={conv.id}
                    onClick={() => navigate(`/dm/${conv.other_user.id}`)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all cursor-pointer ${
                      active ? 'bg-white/10 shadow-sm' : 'hover:bg-white/6'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
                        {otherInitial}
                      </div>
                      <span
                        className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-[#0b0c10] ${
                          online ? 'bg-[#23a55a]' : 'bg-gray-600'
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                          {conv.other_user.display_name ?? conv.other_user.username}
                        </p>
                        {unread > 0 ? (
                          <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        ) : (
                          lastTime && (
                            <span className="shrink-0 text-[10px] text-gray-500">{lastTime}</span>
                          )
                        )}
                      </div>
                      <p
                        className={`truncate text-xs ${
                          unread > 0 ? 'font-medium text-gray-200' : 'text-gray-400'
                        }`}
                      >
                        {lastPreview}
                      </p>
                    </div>
                  </button>
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

export default FriendsSidebar
