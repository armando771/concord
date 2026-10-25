import { create } from 'zustand'
import type { PublicUser } from './authStore'
import { useAuthStore } from './authStore'
import type { PendingRequest, RelationshipType, SendRequestResult } from '../api/friends'
import { relationshipOf } from '../lib/relationship'
import {
  listFriends,
  listPending,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
  listBlocked,
  blockUser,
  unblockUser
} from '../api/friends'

interface FriendState {
  friends: PublicUser[]
  pending: PendingRequest[]
  blocked: PublicUser[]
  loading: boolean
  error: string | null
  fetchFriends: () => Promise<void>
  fetchPending: () => Promise<void>
  loadAll: () => Promise<void>
  sendRequest: (username: string) => Promise<SendRequestResult>
  accept: (username: string) => Promise<void>
  decline: (username: string) => Promise<void>
  cancel: (username: string) => Promise<void>
  remove: (username: string) => Promise<void>
  block: (userId: string) => Promise<void>
  unblock: (userId: string) => Promise<void>
  reset: () => void
}

const isSameSession = (tokenAtStart: string | null): boolean =>
  useAuthStore.getState().accessToken === tokenAtStart

const refetchOnFocus = (): void => {
  if (!useAuthStore.getState().accessToken) return
  useFriendStore.getState().loadAll()
}

if (typeof window !== 'undefined') {
  window.addEventListener('focus', refetchOnFocus)
}

export const useFriendStore = create<FriendState>()((set, get) => ({
  friends: [],
  pending: [],
  blocked: [],
  loading: false,
  error: null,
  fetchFriends: async () => {
    const token = useAuthStore.getState().accessToken
    try {
      const friends = await listFriends()
      if (!isSameSession(token)) return
      set({ friends: Array.isArray(friends) ? friends : [] })
    } catch (err) {
      console.error('[friendStore] fetchFriends error:', err)
      if (isSameSession(token)) set({ friends: [] })
    }
  },
  fetchPending: async () => {
    const token = useAuthStore.getState().accessToken
    try {
      const pending = await listPending()
      if (!isSameSession(token)) return
      set({ pending: Array.isArray(pending) ? pending : [] })
    } catch (err) {
      console.error('[friendStore] fetchPending error:', err)
      if (isSameSession(token)) set({ pending: [] })
    }
  },
  loadAll: async () => {
    const token = useAuthStore.getState().accessToken
    set({ loading: true, error: null })
    try {
      const [friends, pending, blocked] = await Promise.allSettled([
        listFriends(),
        listPending(),
        listBlocked()
      ])

      if (!isSameSession(token)) return

      const resolvedFriends =
        friends.status === 'fulfilled' && Array.isArray(friends.value) ? friends.value : []

      const resolvedPending =
        pending.status === 'fulfilled' && Array.isArray(pending.value) ? pending.value : []

      if (friends.status === 'rejected') {
        console.error('[friendStore] listFriends failed:', friends.reason)
      }
      if (pending.status === 'rejected') {
        console.error('[friendStore] listPending failed:', pending.reason)
      }

      const resolvedBlocked =
        blocked.status === 'fulfilled' && Array.isArray(blocked.value) ? blocked.value : []

      set({ friends: resolvedFriends, pending: resolvedPending, blocked: resolvedBlocked })
    } finally {
      set({ loading: false })
    }
  },
  sendRequest: async (username) => {
    const { result } = await sendFriendRequest(username)
    // Pedido cruzado vira amizade na hora: recarrega as duas listas.
    await get().loadAll()
    return result
  },
  accept: async (username) => {
    await acceptFriendRequest(username)
    await get().fetchPending()
    await get().fetchFriends()
  },
  decline: async (username) => {
    await declineFriendRequest(username)
    await get().fetchPending()
  },
  cancel: async (username) => {
    await cancelFriendRequest(username)
    await get().fetchPending()
  },
  remove: async (username) => {
    // A DM continua na lista (como no Discord); só a amizade sai.
    await removeFriend(username)
    set({ friends: get().friends.filter((f) => f.username !== username) })
    await get().fetchPending()
  },
  block: async (userId) => {
    await blockUser(userId)
    await get().loadAll()
  },
  unblock: async (userId) => {
    await unblockUser(userId)
    await get().loadAll()
  },
  reset: () => set({ friends: [], pending: [], blocked: [], loading: false, error: null })
}))

/** Relação com alguém (amigo, pedido, bloqueado) pelo que já está carregado. */
export function useRelationship(userId: string | undefined): RelationshipType {
  return useFriendStore((s) => (userId ? relationshipOf(userId, s) : 'none'))
}
