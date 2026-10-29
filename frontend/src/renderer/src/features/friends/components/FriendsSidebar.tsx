import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useUIStore } from '../../../shared/store/uiStore'
import { useFriendStore } from '../store/friendStore'
import { useAuthStore } from '../../auth/store/authStore'
import { useTypingStore } from '../../chat/store/typingStore'
import { typersIn } from '../../chat/lib/typing'
import { useChatStore } from '../../chat/store/chatStore'
import { showToast } from '../../../shared/store/toastStore'
import SidebarFooter from '../../../app/SidebarFooter'
import { FriendsIcon, PlusIcon } from '../../../shared/ui/icons'
import ResizeHandle from '../../../shared/ui/ResizeHandle'
import { useResizableWidth } from '../../../shared/hooks/useResizableWidth'
import ConversationRow from './ConversationRow'
import { conversationTitle } from '../../chat/lib/conversations'
import CreateGroupModal from './CreateGroupModal'
import { hideConversation, leaveGroup, type ConversationSummary } from '../../chat/api/conversations'
import ConfirmModal from './ConfirmModal'
import { DmListSkeleton } from '../../../shared/ui/skeleton/layouts'

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
  const conversationsLoaded = useChatStore((s) => s.conversationsLoaded)
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
        className="relative z-10 flex h-full shrink-0 flex-col border-r border-subtle bg-secondary backdrop-blur-2xl"
      >
        <ResizeHandle {...sidebar.handleProps} />
        <div className="flex h-12 shrink-0 items-center border-b border-subtle px-2.5">
          <button
            type="button"
            onClick={() => setQuickSwitcherOpen(true)}
            className="w-full cursor-pointer truncate rounded-md bg-floating px-2 py-1.5 text-left text-ds-sm text-gray-400 transition-colors hover:text-gray-200"
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
                  ? 'bg-fg/10 text-strong'
                  : 'text-gray-400 hover:bg-fg/6 hover:text-gray-200'
              }`}
            >
              <span className="flex items-center gap-3">
                <FriendsIcon className="h-5 w-5" />
                Amigos
              </span>
              {incomingCount > 0 && (
                <span className="rounded-full bg-danger-strong px-1.5 text-[11px] font-bold text-white">
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
                className="cursor-pointer text-gray-400 hover:text-strong"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1 flex flex-col gap-0.5">
              {!conversationsLoaded && conversations.length === 0 && <DmListSkeleton />}
              {conversationsLoaded && conversations.length === 0 && (
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
