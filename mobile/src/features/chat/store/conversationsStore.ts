import { create } from 'zustand'
import { listFriends, type Friend } from '../../friends/api/friends'
import { listConversations, type ConversationSummary } from '../api/conversations'
import type { Message } from '../api/messages'
import { applyMessage as applyToList, bumpUnread, clearUnread, sortConversations } from '../lib/conversationList'
import { shouldCountUnread, type ActiveRoom } from '../lib/unreadCounts'

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface ConversationsState {
  conversations: ConversationSummary[]
  status: Status
  /** Amigos para a busca (só leitura; carregados uma vez, ao precisar). */
  friends: Friend[]
  friendsLoaded: boolean
  load: () => Promise<void>
  /**
   * Mensagem nova (WebSocket): sobe a conversa; desconhecida refaz a lista. Com `ctx`, conta como
   * não lida se for de outra pessoa e a conversa não estiver aberta.
   */
  applyMessage: (message: Message, ctx?: { myId: string | undefined; active: ActiveRoom | null }) => Promise<void>
  /** Abriu a conversa: zera a não lida localmente (o servidor é avisado pelo chat). */
  markRead: (conversationId: string) => void
  loadFriends: () => Promise<void>
  reset: () => void
}

const empty = (): Pick<ConversationsState, 'conversations' | 'status' | 'friends' | 'friendsLoaded'> => ({
  conversations: [],
  status: 'idle',
  friends: [],
  friendsLoaded: false
})

export const useConversationsStore = create<ConversationsState>()((set, get) => ({
  ...empty(),
  load: async () => {
    set({ status: 'loading' })
    try {
      set({ conversations: sortConversations(await listConversations()), status: 'ready' })
    } catch {
      set({ status: 'error' })
    }
  },
  applyMessage: async (message, ctx) => {
    const { list, unknown } = applyToList(get().conversations, message)
    if (unknown) return get().load()
    const counts = ctx && message.conversation_id && shouldCountUnread(message, ctx.myId, ctx.active)
    set({ conversations: counts ? bumpUnread(list, message.conversation_id as string) : list })
  },
  markRead: (conversationId) => set((s) => ({ conversations: clearUnread(s.conversations, conversationId) })),
  loadFriends: async () => {
    if (get().friendsLoaded) return
    try {
      set({ friends: await listFriends(), friendsLoaded: true })
    } catch {
      // a busca continua só com as conversas; tenta de novo na próxima vez
    }
  },
  reset: () => set(empty())
}))
