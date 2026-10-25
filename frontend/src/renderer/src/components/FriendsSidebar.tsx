import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useUIStore, type FriendsTab } from '../store/uiStore'
import { useFriendStore } from '../store/friendStore'
import { useChatStore, usePresenceStatus } from '../store/chatStore'
import { useUserLook } from '../store/profileStore'
import Avatar from './Avatar'
import VoiceConnectedPanel from './call/VoiceConnectedPanel'
import UserBar from './UserBar'
import { FriendsIcon, ClockIcon, UserPlusIcon, ChatBubbleIcon } from './icons'

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

function DmAvatar({
  userId,
  name,
  avatarUrl
}: {
  userId: string
  name: string
  avatarUrl?: string | null
}): React.JSX.Element {
  const status = usePresenceStatus(userId)
  return (
    <Avatar
      userId={userId}
      name={name}
      avatarUrl={avatarUrl}
      size={32}
      status={status}
      cutoutColor="#0b0c10"
    />
  )
}

/** Nome da conversa, já com a troca mais nova (user:update). */
function DmName({ userId, name }: { userId: string; name: string }): React.JSX.Element {
  return <>{useUserLook(userId, { name }).name}</>
}

export function FriendsSidebar(): React.JSX.Element {
  const navigate = useNavigate()
  const { userId } = useParams<{ userId: string }>()
  const pending = useFriendStore((s) => s.pending)
  const loadAll = useFriendStore((s) => s.loadAll)
  const friendsTab = useUIStore((s) => s.friendsTab)
  const setFriendsTab = useUIStore((s) => s.setFriendsTab)
  const conversations = useChatStore((s) => s.conversations)
  const conversationsLoading = useChatStore((s) => s.conversationsLoading)
  const unreadByRoom = useChatStore((s) => s.unreadByRoom)
  const fetchConversations = useChatStore((s) => s.fetchConversations)


  useEffect(() => {
    loadAll()
    fetchConversations()
  }, [loadAll, fetchConversations])

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
                const unread = unreadByRoom[`conversation:${conv.id}`] ?? 0
                const lastPreview = conv.last_message?.content ?? 'Inicie uma conversa!'
                const lastTime = formatLastMessageTime(conv.last_message?.created_at)
                return (
                  <button
                    key={conv.id}
                    onClick={() => navigate(`/dm/${conv.other_user.id}`)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all cursor-pointer ${
                      active ? 'bg-white/10 shadow-sm' : 'hover:bg-white/6'
                    }`}
                  >
                    <DmAvatar
                      userId={conv.other_user.id}
                      name={conv.other_user.display_name ?? conv.other_user.username}
                      avatarUrl={conv.other_user.avatar_url}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                          <DmName
                            userId={conv.other_user.id}
                            name={conv.other_user.display_name ?? conv.other_user.username}
                          />
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

        <UserBar />
      </aside>

    </>
  )
}

export default FriendsSidebar
