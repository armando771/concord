import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useUIStore } from '../store/uiStore'
import { useFriendStore } from '../store/friendStore'
import { useAuthStore } from '../store/authStore'
import { useTypingStore } from '../store/typingStore'
import { typersIn } from '../lib/typing'
import { useChatStore, usePresenceStatus } from '../store/chatStore'
import { useUserLook } from '../store/profileStore'
import { useUserMenuStore } from '../store/userMenuStore'
import { showToast } from '../store/toastStore'
import Avatar from './Avatar'
import SidebarFooter from './SidebarFooter'
import { FriendsIcon, PlusIcon, XIcon } from './icons'
import ResizeHandle from './ResizeHandle'
import { useResizableWidth } from './useResizableWidth'
import GroupIcon from './friends/GroupIcon'
import CreateGroupModal from './friends/CreateGroupModal'
import { conversationRoute, conversationTitle } from '../lib/conversations'
import { hideConversation, leaveGroup, type ConversationSummary } from '../api/conversations'
import ConfirmModal from './friends/ConfirmModal'
import { GameLine } from './ActivityLine'
import StyledName from './StyledName'
import type { NameStyle } from '../lib/nameStyle'

const SIDEBAR_BG = '#0b0c10'

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
      cutoutColor={SIDEBAR_BG}
    />
  )
}

/** Nome da conversa, já com a troca mais nova (user:update). */
function DmName({
  userId,
  name,
  style
}: {
  userId: string
  name: string
  style?: NameStyle
}): React.JSX.Element {
  return <StyledName name={useUserLook(userId, { name }).name} userId={userId} style={style} />
}

function ConversationRow({
  conv,
  active,
  unread,
  typing,
  meId,
  onClose
}: {
  conv: ConversationSummary
  active: boolean
  unread: number
  /** Alguém digitando nesta conversa (DM ou grupo). */
  typing: boolean
  meId: string | undefined
  onClose: (conv: ConversationSummary) => void
}): React.JSX.Element {
  const navigate = useNavigate()
  const other = conv.other_user
  const isGroup = conv.type === 'group'
  const title = conversationTitle(conv, meId)

  const onContextMenu = (e: React.MouseEvent): void => {
    if (!other) return
    e.preventDefault()
    useUserMenuStore.getState().open({
      userId: other.id,
      name: other.display_name || other.username,
      username: other.username,
      conversationId: conv.id,
      x: e.clientX,
      y: e.clientY
    })
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(conversationRoute(conv, meId))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(conversationRoute(conv, meId))
      }}
      onContextMenu={onContextMenu}
      className={`group flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors ${
        active ? 'bg-white/10' : 'hover:bg-white/6'
      }`}
    >
      {isGroup || !other ? (
        <GroupIcon id={conv.id} iconUrl={conv.icon_url} />
      ) : (
        <DmAvatar
          userId={other.id}
          name={other.display_name || other.username}
          avatarUrl={other.avatar_url}
        />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-ds-md ${
            active || unread > 0
              ? 'font-semibold text-white'
              : 'font-medium text-gray-400 group-hover:text-gray-200'
          }`}
        >
          {!isGroup && other ? (
            <DmName
              userId={other.id}
              name={other.display_name || other.username}
              style={other.name_style}
            />
          ) : (
            title
          )}
        </p>
        {typing ? (
          <p className="truncate text-ds-xs italic text-violet-300">digitando…</p>
        ) : (
          (isGroup && (
            <p className="truncate text-ds-xs font-medium text-gray-500">
              {(conv.members ?? []).length} membros
            </p>
          )) ||
          (other && <GameLine userId={other.id} className="text-ds-xs font-medium text-gray-500" />)
        )}
      </div>
      {unread > 0 && (
        <span className="shrink-0 rounded-full bg-[#f23f43] px-1.5 text-[11px] font-bold text-white group-hover:hidden">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
      <button
        type="button"
        aria-label={isGroup ? 'Sair do grupo' : 'Fechar DM'}
        title={isGroup ? 'Sair do grupo' : 'Fechar DM'}
        onClick={(e) => {
          e.stopPropagation()
          onClose(conv)
        }}
        className="hidden shrink-0 cursor-pointer text-gray-400 hover:text-white group-hover:block"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  )
}

export function FriendsSidebar(): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const { userId, conversationId } = useParams<{ userId: string; conversationId: string }>()
  const meId = useAuthStore((s) => s.user?.id)
  // Só as conversas com alguém digitando: aviso de canal não redesenha a lista.
  const typingDms = useTypingStore(
    useShallow((s) =>
      Object.keys(s.byRoom).filter(
        (room) => room.startsWith('conversation:') && typersIn(s.byRoom, room, meId).length > 0
      )
    )
  )
  const incomingCount = useFriendStore(
    (s) => s.pending.filter((p) => p.direction === 'incoming').length
  )
  const loadAll = useFriendStore((s) => s.loadAll)
  const setFriendsTab = useUIStore((s) => s.setFriendsTab)
  const conversations = useChatStore((s) => s.conversations)
  const conversationsLoading = useChatStore((s) => s.conversationsLoading)
  const unreadByRoom = useChatStore((s) => s.unreadByRoom)
  const fetchConversations = useChatStore((s) => s.fetchConversations)
  const setQuickSwitcherOpen = useUIStore((s) => s.setQuickSwitcherOpen)
  const [groupOpen, setGroupOpen] = useState(false)
  const [leaving, setLeaving] = useState<ConversationSummary | null>(null)

  // Mesma preferência de largura na barra de canais e na de DMs/amigos.
  const sidebar = useResizableWidth('channels')

  useEffect(() => {
    loadAll()
    fetchConversations()
  }, [loadAll, fetchConversations])

  const onFriendsPage = location.pathname === '/' || location.pathname === '/friends'

  const isActive = (conv: ConversationSummary): boolean =>
    conv.type === 'group' ? conv.id === conversationId : conv.other_user?.id === userId

  const closeConversation = async (conv: ConversationSummary): Promise<void> => {
    if (conv.type === 'group') {
      setLeaving(conv)
      return
    }
    try {
      await hideConversation(conv.id)
      useChatStore.setState((s) => ({
        conversations: s.conversations.filter((c) => c.id !== conv.id)
      }))
      if (isActive(conv)) navigate('/friends')
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Não foi possível fechar a DM.')
    }
  }

  return (
    <>
      {/* z-10: a alça de redimensionar passa um pouco da borda, sobre o conteúdo. */}
      <aside
        style={sidebar.panelStyle}
        className="relative z-10 flex h-full shrink-0 flex-col border-r border-white/6 bg-[#0b0c10]/80 backdrop-blur-2xl"
      >
        <ResizeHandle {...sidebar.handleProps} />
        <div className="flex h-12 shrink-0 items-center border-b border-white/6 px-2.5">
          <button
            type="button"
            onClick={() => setQuickSwitcherOpen(true)}
            className="w-full cursor-pointer truncate rounded-md bg-[#111214] px-2 py-1.5 text-left text-ds-sm text-gray-400 transition-colors hover:text-gray-200"
          >
            Encontre ou comece uma conversa
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-2 py-2">
          <nav className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => {
                setFriendsTab('online')
                navigate('/friends')
              }}
              className={`flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-ds-md font-medium transition-colors ${
                onFriendsPage
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:bg-white/6 hover:text-gray-200'
              }`}
            >
              <span className="flex items-center gap-3">
                <FriendsIcon className="h-5 w-5" />
                Amigos
              </span>
              {incomingCount > 0 && (
                <span className="rounded-full bg-[#f23f43] px-1.5 text-[11px] font-bold text-white">
                  {incomingCount}
                </span>
              )}
            </button>
          </nav>

          <div>
            <div className="group flex items-center justify-between px-2">
              <p className="text-ds-sm font-medium text-gray-400 group-hover:text-gray-200">
                Mensagens diretas
              </p>
              <button
                type="button"
                title="Criar DM"
                aria-label="Criar DM"
                onClick={() => setGroupOpen(true)}
                className="cursor-pointer text-gray-400 hover:text-white"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1 flex flex-col gap-0.5">
              {conversationsLoading && conversations.length === 0 && (
                <p className="px-2 py-1 text-ds-sm italic text-gray-500">Carregando...</p>
              )}
              {!conversationsLoading && conversations.length === 0 && (
                <p className="px-2 py-1 text-ds-sm italic text-gray-500">Nenhuma conversa ainda.</p>
              )}
              {conversations.map((conv) => (
                <ConversationRow
                  key={conv.id}
                  conv={conv}
                  active={isActive(conv)}
                  unread={unreadByRoom[`conversation:${conv.id}`] ?? 0}
                  typing={typingDms.includes(`conversation:${conv.id}`)}
                  meId={meId}
                  onClose={closeConversation}
                />
              ))}
            </div>
          </div>
        </div>

        {/* "Voz conectada" na chamada + a barra do usuário (igual em todas as telas) */}
        <SidebarFooter />
      </aside>

      {groupOpen && <CreateGroupModal open onClose={() => setGroupOpen(false)} />}
      <ConfirmModal
        open={leaving !== null}
        title={`Sair de '${leaving ? conversationTitle(leaving, meId) : ''}'`}
        confirmLabel="Sair do grupo"
        onClose={() => setLeaving(null)}
        onConfirm={async () => {
          if (!leaving) return
          try {
            await leaveGroup(leaving.id)
            useChatStore.setState((s) => ({
              conversations: s.conversations.filter((c) => c.id !== leaving.id)
            }))
            if (isActive(leaving)) navigate('/friends')
          } catch (err) {
            showToast.error(err instanceof Error ? err.message : 'Não foi possível sair do grupo.')
          }
        }}
      >
        Tem certeza que quer sair do grupo? Você só volta se alguém te adicionar de novo.
      </ConfirmModal>
    </>
  )
}

export default FriendsSidebar
