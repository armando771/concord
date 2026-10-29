import { create } from 'zustand'
import { listFriends, type Friend } from '../../friends/api/friends'
import { listConversations, type ConversationSummary } from '../api/conversations'
import type { Message } from '../api/messages'
import { applyMessage as applyToList, sortConversations } from '../lib/conversationList'

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface ConversationsState {
  conversations: ConversationSummary[]
  status: Status
  /** Amigos para a busca (só leitura; carregados uma vez, ao precisar). */
  friends: Friend[]
  friendsLoaded: boolean
  load: () => Promise<void>
  /** Mensagem nova (WebSocket): sobe a conversa; desconhecida refaz a lista. */
  applyMessage: (message: Message) => Promise<void>
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
  applyMessage: async (message) => {
    const { list, unknown } = applyToList(get().conversations, message)
    if (unknown) return get().load()
    set({ conversations: list })
  },
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
